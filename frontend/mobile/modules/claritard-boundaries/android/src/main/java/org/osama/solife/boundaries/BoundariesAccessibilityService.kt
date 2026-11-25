package org.osama.solife.boundaries

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

/**
 * The actual enforcement point. Fires on every foreground-window change system-wide; if the
 * window belongs to a blocked package (and blocking is currently active), it immediately sends
 * the user home before the app finishes drawing. This is the same primitive every non-root
 * Android "app blocker"/parental-control app uses — there is no API to pre-empt another app's
 * process from starting at all, only to react the instant its window appears.
 *
 * Also does best-effort "uninstall guard": if Settings/the package installer surfaces a screen
 * that looks like it's trying to remove this app (its Device Admin deactivation confirmation,
 * the Device Admin apps list, an uninstall dialog), it backs out to the home screen the same
 * way. This only runs once Device Admin is actually active, and only for screens that mention
 * both this app AND an actual removal-flavored word - not just any Settings screen that happens
 * to mention the app's name. The first version of this matched on the app's name alone, which
 * meant it fired on the Device Admin *activation* screen too (the one this app itself opens to
 * ask you to turn admin on) and bounced you home before you could tap "Activate" - caught by
 * testing on a real device, not something a build or a unit test would ever catch.
 */
class BoundariesAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        serviceInfo = AccessibilityServiceInfo().apply {
            // TYPE_WINDOW_STATE_CHANGED alone misses a real case, confirmed live on a Samsung/
            // OneUI device: resuming an already-running blocked app from the Recents/app-switcher
            // doesn't always fire it, letting the app back in without a fresh block check.
            // TYPE_WINDOWS_CHANGED fires for that case too, so both are needed.
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                AccessibilityEvent.TYPE_WINDOWS_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        }
        ShizukuBridge.ensureBound()
        lastTickAt = System.currentTimeMillis()
        screenUsable = isScreenUsable()
        val rules = BoundariesPrefs.getRules(applicationContext)
        if (!screenUsable) UsageTracker.relockAll(applicationContext, lastTickAt, rules)
        if (BoundariesPrefs.isEnforcementActive(applicationContext)) {
            stopExpiredTimedApps(lastTickAt, screenUsable, rules)
        }
        SessionExpiryScheduler.scheduleNext(
            applicationContext,
            UsageTracker.nextTimedSessionExpiry(applicationContext, lastTickAt, rules),
        )
        handler.removeCallbacks(ticker)
        handler.postDelayed(ticker, TICK_MS)
    }

    private val handler = Handler(Looper.getMainLooper())
    private val boundaryToast by lazy { BoundaryToast(this) }
    private val delayOverlay by lazy { BoundaryDelayOverlay(this, ::finishDelay, ::cancelDelay) }
    private var currentFg: String? = null
    private var lastTickAt = 0L
    private var screenUsable = true
    private var unknownFgTicks = 0
    private val recentKicks = HashMap<String, Long>()
    private val recentCancels = HashMap<String, Long>()

    private val ticker = object : Runnable {
        override fun run() {
            try {
                tick()
            } catch (e: Exception) {
                Log.w(TAG, "tick failed", e)
            }
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val eventPkg = event.packageName?.toString()
        if (!BoundariesPrefs.isEnforcementActive(applicationContext)) {
            currentFg = null
            delayOverlay.forget()
            BoundaryCountdownNotification.clear(applicationContext)
            return
        }

        // Fast path: a window from an app that's blocked / out of time / out of opens right now -
        // kick it before it finishes drawing, without waiting for the window list to catch up.
        // This never *counts* anything (an event can come from an overlay, not a real open).
        val rule = eventPkg?.let { BoundariesPrefs.getRules(applicationContext)[it] }
        if (rule != null && event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val reason = UsageTracker.peekBlock(applicationContext, rule, System.currentTimeMillis(), labelFor(rule.pkg))
            if (reason != null) {
                kick(rule.pkg, reason)
                return
            }
        }

        // Normal path: work out what's really in the foreground from the window list (an event's
        // package can be the keyboard, a chat-head overlay, the notification shade...).
        val fg = resolveForeground()
        if (fg != null && fg != currentFg) onForegroundChanged(fg, System.currentTimeMillis())

        val pkg = eventPkg ?: return
        if (isSystemUninstallSurface(pkg) && isDeviceAdminActive() && looksLikeRemovalAttempt()) {
            performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    private fun tick() {
        val now = System.currentTimeMillis()
        val delta = (now - lastTickAt).coerceIn(0, MAX_TICK_DELTA_MS)
        lastTickAt = now
        val ctx = applicationContext
        if (!BoundariesPrefs.isEnforcementActive(ctx)) {
            currentFg = null
            delayOverlay.forget()
            BoundaryCountdownNotification.clear(ctx)
            return
        }
        val usable = isScreenUsable()
        if (screenUsable && !usable) UsageTracker.relockAll(ctx, now, BoundariesPrefs.getRules(ctx))
        screenUsable = usable
        val rules = BoundariesPrefs.getRules(ctx)
        if (rules.isEmpty()) {
            BoundaryCountdownNotification.clear(ctx)
            return
        }
        stopExpiredTimedApps(now, usable, rules)

        val fg = if (usable) resolveForegroundSteady() else null
        if (fg != currentFg) {
            onForegroundChanged(fg, now)
        } else if (fg != null) {
            rules[fg]?.let { handleVerdict(fg, UsageTracker.onTick(ctx, it, now, delta, labelFor(fg))) }
        }
        BoundaryCountdownNotification.update(ctx, UsageTracker.countdowns(ctx, now, currentFg, rules), ::labelFor)
    }

    private fun stopExpiredTimedApps(now: Long, usable: Boolean, rules: Map<String, AppRule>) {
        for (pkg in UsageTracker.expireTimedSessions(applicationContext, now, rules)) {
            if (usable && currentFg == pkg) {
                kick(pkg, "${labelFor(pkg)}: time's up for this open")
            } else {
                // A music app may still be streaming from a foreground service after its screen
                // disappears; HOME cannot stop that, so stop its audio and the package itself.
                AppStopper.stop(applicationContext, pkg)
            }
        }
        AppStopper.silenceStragglers(applicationContext, now, rules)
    }

    /**
     * [resolveForeground], except that a single unreadable window list (it is briefly empty during
     * app transitions) keeps the current app instead of counting as leaving it, which used to hide
     * and restart the countdown. Only [UNKNOWN_FG_TICKS] unreadable ticks in a row count as null.
     */
    private fun resolveForegroundSteady(): String? {
        val fg = resolveForeground()
        if (fg != null) {
            unknownFgTicks = 0
            return fg
        }
        unknownFgTicks += 1
        return if (unknownFgTicks < UNKNOWN_FG_TICKS) currentFg else null
    }

    private fun isScreenUsable(): Boolean {
        val pm = applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        val km = applicationContext.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        return pm.isInteractive && !km.isKeyguardLocked
    }

    private fun onForegroundChanged(newFg: String?, now: Long) {
        val ctx = applicationContext
        if (currentFg != null) UsageTracker.onLeave(ctx, now)
        currentFg = newFg
        // Leaving a delayed app (or the screen turning off) resets its countdown.
        if (delayOverlay.pkg != null && delayOverlay.pkg != newFg) delayOverlay.hide()
        val pkg = newFg ?: return
        if (pkg == ctx.packageName) return
        val rule = BoundariesPrefs.getRules(ctx)[pkg] ?: return

        val cancelledAt = recentCancels[pkg]
        if (cancelledAt != null && now - cancelledAt < KICK_DEBOUNCE_MS) {
            performGlobalAction(GLOBAL_ACTION_HOME)
            return
        }

        // A just-kicked app often fires a stray window event or two on its way out; re-kick it
        // quietly instead of counting that as a new open.
        val kickedAt = recentKicks[pkg]
        if (kickedAt != null && now - kickedAt < KICK_DEBOUNCE_MS) {
            kick(pkg, null)
            return
        }
        handleVerdict(pkg, UsageTracker.onEnter(ctx, rule, now, labelFor(pkg)))
    }

    private fun handleVerdict(pkg: String, verdict: UsageTracker.Verdict) {
        when (verdict) {
            is UsageTracker.Verdict.Allow -> {}
            is UsageTracker.Verdict.NewOpen -> toast(verdict.message)
            is UsageTracker.Verdict.Block -> kick(pkg, verdict.message)
            is UsageTracker.Verdict.Delay -> startDelay(pkg)
        }
    }

    private fun startDelay(pkg: String) {
        if (delayOverlay.pkg == pkg) return
        if (delayOverlay.pkg != null) delayOverlay.forget()
        val rule = BoundariesPrefs.getRules(applicationContext)[pkg] ?: return
        val shown = delayOverlay.show(pkg, labelFor(pkg), rule.delaySeconds, rule.delayMessage, rule.delayAutoOpen)
        // Without the overlay there is no way to make the user wait, so don't let the app in free.
        if (!shown) kick(pkg, "${labelFor(pkg)}: couldn't show the countdown")
    }

    /** The countdown is over and the user chose to open (or it opens by itself). */
    private fun finishDelay(pkg: String) {
        delayOverlay.forget()
        val rule = BoundariesPrefs.getRules(applicationContext)[pkg] ?: return
        // The overlay only shows while pkg is in front, so trust a fresh reading over a stale one.
        if (currentFg != pkg && resolveForeground() == pkg) currentFg = pkg
        if (currentFg != pkg) return
        handleVerdict(pkg, UsageTracker.unlock(applicationContext, rule, System.currentTimeMillis(), labelFor(pkg)))
    }

    private fun cancelDelay(pkg: String) {
        delayOverlay.forget()
        recentCancels[pkg] = System.currentTimeMillis()
        if (currentFg == pkg) currentFg = null
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    /**
     * Topmost real app window. Application-type windows only: the keyboard, system bars, the
     * notification shade and other apps' overlays are different window types, so they don't
     * count as "leaving" the app underneath them.
     */
    private fun resolveForeground(): String? {
        val ws = try {
            windows
        } catch (e: Exception) {
            null
        } ?: return null
        var fallback: String? = null
        for (w in ws) {
            if (w.type != AccessibilityWindowInfo.TYPE_APPLICATION) continue
            val root = w.root ?: continue
            val p = root.packageName?.toString()
            @Suppress("DEPRECATION") root.recycle()
            if (p == null) continue
            if (w.isActive || w.isFocused) return p
            if (fallback == null) fallback = p
        }
        return fallback
    }

    private fun labelFor(packageName: String): String = try {
        val pm = applicationContext.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    } catch (e: Exception) {
        packageName
    }

    private fun toast(message: String) {
        boundaryToast.show(message)
    }

    /** Send the user home and force-quit [packageName]. [message] null = no toast. */
    private fun kick(packageName: String, message: String?) {
        val now = System.currentTimeMillis()
        performGlobalAction(GLOBAL_ACTION_HOME)
        val alreadyKicked = recentKicks[packageName]?.let { now - it < KICK_DEBOUNCE_MS } ?: false
        recentKicks[packageName] = now
        if (currentFg == packageName) currentFg = null
        if (delayOverlay.pkg == packageName) delayOverlay.forget()
        UsageTracker.endSession(applicationContext, packageName, now)
        if (message != null && !alreadyKicked) toast(message)
        // HOME leaves the process (and any audio it plays) running.
        AppStopper.stop(applicationContext, packageName)
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        BoundaryCountdownNotification.clear(applicationContext)
        delayOverlay.forget()
        super.onDestroy()
    }

    private fun isSystemUninstallSurface(packageName: String): Boolean {
        return packageName == "com.android.settings" ||
            packageName == "com.google.android.packageinstaller" ||
            packageName == "com.android.packageinstaller"
    }

    private fun isDeviceAdminActive(): Boolean {
        val dpm = applicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(applicationContext, BoundariesAdminReceiver::class.java)
        return dpm.isAdminActive(adminComponent)
    }

    /** True only when the visible screen mentions this app AND uses removal-flavored wording. */
    private fun looksLikeRemovalAttempt(): Boolean {
        val ownLabel = try {
            applicationContext.applicationInfo.loadLabel(applicationContext.packageManager).toString()
        } catch (e: Exception) {
            "Claritard"
        }
        val ownPackage = applicationContext.packageName

        val root = rootInActiveWindow ?: return false
        val collected = StringBuilder()
        try {
            collectText(root, collected, depth = 0)
        } finally {
            root.recycle()
        }

        val text = collected.toString().lowercase()
        val mentionsSelf = text.contains(ownLabel.lowercase()) || text.contains(ownPackage)
        val mentionsRemoval = REMOVAL_KEYWORDS.any { text.contains(it) }
        return mentionsSelf && mentionsRemoval
    }

    private fun collectText(node: AccessibilityNodeInfo, out: StringBuilder, depth: Int) {
        if (depth > 8) return
        node.text?.let { out.append(it).append(' ') }
        node.contentDescription?.let { out.append(it).append(' ') }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectText(child, out, depth + 1)
            child.recycle()
        }
    }

    override fun onInterrupt() {}

    companion object {
        private const val TAG = "BoundariesA11y"
        private const val TICK_MS = 1000L
        private const val MAX_TICK_DELTA_MS = 3000L
        private const val KICK_DEBOUNCE_MS = 2000L
        private const val UNKNOWN_FG_TICKS = 3
        private val REMOVAL_KEYWORDS = listOf("uninstall", "deactivate", "device admin apps")
    }
}
