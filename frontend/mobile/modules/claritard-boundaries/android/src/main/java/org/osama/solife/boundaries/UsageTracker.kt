package org.osama.solife.boundaries

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Today's per-app usage for apps that have limits: foreground minutes, number of opens, and the
 * state of the current "open" (session). Lives in memory in the app process (the accessibility
 * service and the React Native bridge share it) and is persisted to plain SharedPreferences
 * every few seconds, so a process restart loses at most a few seconds of counted time.
 * Resets at local midnight.
 *
 * What counts as an "open": the app coming to the foreground when it has no live session. A
 * session stays live while the app is in the foreground, and for [SESSION_GRACE_MS] after
 * leaving it - so a quick trip to another app (sharing a link, answering a notification) and
 * back doesn't burn an extra open. A session ends when its time runs out (the app is force-
 * quit) or when the user has been away longer than the grace period.
 */
object UsageTracker {

    const val SESSION_GRACE_MS = 60_000L
    private const val PREFS = "boundaries_usage"
    private const val KEY_STATE = "state"
    private const val SAVE_INTERVAL_MS = 10_000L

    class AppUsage(
        var usedMs: Long = 0,
        var opens: Int = 0,
        var sessionUsedMs: Long = 0,
        var sessionActive: Boolean = false,
        var lastFgAt: Long = 0,
        var warned: Boolean = false,
    )

    sealed class Verdict {
        object Allow : Verdict()
        data class Block(val message: String) : Verdict()
        /** Allowed, and this entry just started a new counted open; [message] is shown as a toast. */
        data class NewOpen(val message: String) : Verdict()
    }

    private var day: String = ""
    private val apps = HashMap<String, AppUsage>()
    private var loaded = false
    private var dirty = false
    private var lastSavedAt = 0L

    private fun todayKey(now: Long): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(now))

    private fun ensureLoaded(context: Context, now: Long) {
        if (!loaded) {
            loaded = true
            try {
                val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null)
                if (raw != null) {
                    val o = JSONObject(raw)
                    day = o.optString("day", "")
                    val a = o.optJSONObject("apps") ?: JSONObject()
                    for (pkg in a.keys()) {
                        val u = a.getJSONObject(pkg)
                        apps[pkg] = AppUsage(
                            usedMs = u.optLong("usedMs"),
                            opens = u.optInt("opens"),
                            sessionUsedMs = u.optLong("sessionUsedMs"),
                            sessionActive = u.optBoolean("sessionActive"),
                            lastFgAt = u.optLong("lastFgAt"),
                            warned = u.optBoolean("warned"),
                        )
                    }
                }
            } catch (e: Exception) {
                apps.clear()
            }
        }
        val today = todayKey(now)
        if (day != today) {
            day = today
            apps.clear()
            dirty = true
        }
    }

    private fun usage(pkg: String) = apps.getOrPut(pkg) { AppUsage() }

    private fun save(context: Context, now: Long, force: Boolean) {
        if (!dirty) return
        if (!force && now - lastSavedAt < SAVE_INTERVAL_MS) return
        val a = JSONObject()
        for ((pkg, u) in apps) {
            a.put(pkg, JSONObject()
                .put("usedMs", u.usedMs)
                .put("opens", u.opens)
                .put("sessionUsedMs", u.sessionUsedMs)
                .put("sessionActive", u.sessionActive)
                .put("lastFgAt", u.lastFgAt)
                .put("warned", u.warned))
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_STATE, JSONObject().put("day", day).put("apps", a).toString())
            .apply()
        dirty = false
        lastSavedAt = now
    }

    private fun mins(ms: Long): String {
        val m = (ms + 59_999) / 60_000
        return if (m == 1L) "1 min" else "$m min"
    }

    /**
     * Read-only: if [rule]'s app can't be used at all right now (blocked by schedule, daily time
     * used up, or out of opens with no live session), the reason; otherwise null.
     */
    @Synchronized
    fun peekBlock(context: Context, rule: AppRule, now: Long, label: String): String? {
        ensureLoaded(context, now)
        val cal = Calendar.getInstance().apply { timeInMillis = now }
        if (rule.isBlockedAt(cal)) return "$label is blocked right now"
        if (!rule.limitsInForceAt(cal)) return null
        val u = apps[rule.pkg] ?: return null
        if (rule.dailyLimitMin > 0 && u.usedMs >= rule.dailyLimitMin * 60_000L) {
            return "$label: daily limit of ${rule.dailyLimitMin} min reached"
        }
        val sessionMs = rule.sessionMin * 60_000L
        val sessionLive = u.sessionActive && now - u.lastFgAt <= SESSION_GRACE_MS &&
            (sessionMs == 0L || u.sessionUsedMs < sessionMs)
        if (!sessionLive && rule.maxOpens > 0 && u.opens >= rule.maxOpens) {
            return "$label: all ${rule.maxOpens} opens used today"
        }
        return null
    }

    /**
     * Called when [rule]'s app comes to the foreground (or is found in the foreground with no live
     * session, e.g. because its limit window just started). Decides whether it may stay, and if
     * it's starting a new open, counts it.
     */
    @Synchronized
    fun onEnter(context: Context, rule: AppRule, now: Long, label: String): Verdict {
        ensureLoaded(context, now)
        val cal = Calendar.getInstance().apply { timeInMillis = now }
        if (rule.isBlockedAt(cal)) return Verdict.Block("$label is blocked right now")
        if (!rule.limitsInForceAt(cal)) return Verdict.Allow

        val u = usage(rule.pkg)
        if (rule.dailyLimitMin > 0 && u.usedMs >= rule.dailyLimitMin * 60_000L) {
            return Verdict.Block("$label: daily limit of ${rule.dailyLimitMin} min reached")
        }
        val sessionMs = rule.sessionMin * 60_000L
        val sessionLive = u.sessionActive &&
            now - u.lastFgAt <= SESSION_GRACE_MS &&
            (sessionMs == 0L || u.sessionUsedMs < sessionMs)
        if (sessionLive) {
            u.lastFgAt = now
            return Verdict.Allow
        }
        if (rule.maxOpens > 0 && u.opens >= rule.maxOpens) {
            u.sessionActive = false
            dirty = true
            save(context, now, force = true)
            return Verdict.Block("$label: all ${rule.maxOpens} opens used today")
        }
        u.opens += 1
        u.sessionActive = true
        u.sessionUsedMs = 0
        u.lastFgAt = now
        u.warned = false
        dirty = true
        save(context, now, force = true)

        val parts = ArrayList<String>()
        if (rule.maxOpens > 0) parts.add("open ${u.opens} of ${rule.maxOpens}")
        if (sessionMs > 0) {
            val dailyLeft = if (rule.dailyLimitMin > 0) rule.dailyLimitMin * 60_000L - u.usedMs else Long.MAX_VALUE
            parts.add("${mins(minOf(sessionMs, dailyLeft))} this time")
        } else if (rule.dailyLimitMin > 0) {
            parts.add("${mins(rule.dailyLimitMin * 60_000L - u.usedMs)} left today")
        }
        return if (parts.isEmpty()) Verdict.Allow else Verdict.NewOpen("$label: " + parts.joinToString(", "))
    }

    /**
     * Called about once a second while [rule]'s app stays in the foreground. Adds [deltaMs] of use
     * (only while the rule's limits are in force) and says whether it has run out.
     * Returns a Block verdict to kick the app out, a NewOpen to show a toast (used for the
     * one-minute warning), or Allow.
     */
    @Synchronized
    fun onTick(context: Context, rule: AppRule, now: Long, deltaMs: Long, label: String): Verdict {
        ensureLoaded(context, now)
        val cal = Calendar.getInstance().apply { timeInMillis = now }
        if (rule.isBlockedAt(cal)) return Verdict.Block("$label is blocked right now")
        if (!rule.limitsInForceAt(cal)) return Verdict.Allow

        val u = usage(rule.pkg)
        if (!u.sessionActive || now - u.lastFgAt > SESSION_GRACE_MS + 5_000) {
            // Limits just came into force while the app was already open (or tracking lapsed):
            // treat it like opening the app now.
            return onEnter(context, rule, now, label)
        }
        u.usedMs += deltaMs
        u.sessionUsedMs += deltaMs
        u.lastFgAt = now
        dirty = true

        val dailyLeft = if (rule.dailyLimitMin > 0) rule.dailyLimitMin * 60_000L - u.usedMs else Long.MAX_VALUE
        val sessionLeft = if (rule.sessionMin > 0) rule.sessionMin * 60_000L - u.sessionUsedMs else Long.MAX_VALUE
        val left = minOf(dailyLeft, sessionLeft)

        if (left <= 0) {
            u.sessionActive = false
            save(context, now, force = true)
            return if (dailyLeft <= 0) {
                Verdict.Block("$label: daily limit of ${rule.dailyLimitMin} min reached")
            } else {
                Verdict.Block("$label: time's up for this open")
            }
        }
        save(context, now, force = false)
        if (left <= 60_000 && !u.warned) {
            u.warned = true
            return Verdict.NewOpen("$label: 1 minute left")
        }
        return Verdict.Allow
    }

    /** The app left the foreground (session stays live for the grace period). */
    @Synchronized
    fun onLeave(context: Context, pkg: String, now: Long) {
        ensureLoaded(context, now)
        apps[pkg]?.let {
            if (it.sessionActive) it.lastFgAt = now
            dirty = true
        }
        save(context, now, force = true)
    }

    /** The app was kicked out: its current open is over. */
    @Synchronized
    fun endSession(context: Context, pkg: String, now: Long) {
        ensureLoaded(context, now)
        apps[pkg]?.let {
            it.sessionActive = false
            dirty = true
        }
        save(context, now, force = true)
    }

    /** Today's usage as JSON for the UI: {pkg: {usedMs, opens, sessionUsedMs, sessionActive}}. */
    @Synchronized
    fun todayJson(context: Context): String {
        val now = System.currentTimeMillis()
        ensureLoaded(context, now)
        val o = JSONObject()
        for ((pkg, u) in apps) {
            val live = u.sessionActive && now - u.lastFgAt <= SESSION_GRACE_MS
            o.put(pkg, JSONObject()
                .put("usedMs", u.usedMs)
                .put("opens", u.opens)
                .put("sessionUsedMs", if (live) u.sessionUsedMs else 0)
                .put("sessionActive", live))
        }
        return o.toString()
    }
}
