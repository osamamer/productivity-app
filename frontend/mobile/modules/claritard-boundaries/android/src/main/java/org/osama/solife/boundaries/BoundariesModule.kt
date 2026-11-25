package org.osama.solife.boundaries

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

private const val MIN_PASSWORD_LENGTH = 8
private const val ICON_SIZE_PX = 96

class BoundariesException(code: String, message: String) : CodedException(code, message, null)

/**
 * The JavaScript bridge for Boundaries. All real state lives in BoundariesPrefs; this validates
 * input and translates between JavaScript values and the Android APIs.
 */
class BoundariesModule : Module() {

    private val context: Context
        get() = appContext.reactContext?.applicationContext ?: throw BoundariesException("NO_CONTEXT", "The app is not ready yet")

    /**
     * Some system screens (Samsung's device-admin activation screen among them) refuse to launch
     * with FLAG_ACTIVITY_NEW_TASK, which is otherwise required from a non-Activity Context.
     * Launch from the current Activity when there is one.
     */
    private fun startActivityPreferringCurrentActivity(intent: Intent) {
        val activity = appContext.currentActivity
        if (activity != null) {
            activity.startActivity(intent)
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    private fun requireLength(pw: String) {
        if (pw.length < MIN_PASSWORD_LENGTH) throw BoundariesException("TOO_SHORT", "Passwords must be at least 8 characters")
    }

    private fun requireMaster(pw: String) {
        if (!BoundariesPrefs.verifyMasterPassword(context, pw)) throw BoundariesException("BAD_MASTER", "Master password incorrect")
    }

    override fun definition() = ModuleDefinition {
        Name("ClaritardBoundaries")

        // ---- Passwords ----

        AsyncFunction("hasPasswordsSet") { BoundariesPrefs.hasPasswordsSet(context) }

        AsyncFunction("setupPasswords") { unlockPw: String, masterPw: String ->
            if (BoundariesPrefs.hasPasswordsSet(context)) throw BoundariesException("ALREADY_SET", "Passwords are already set up")
            requireLength(unlockPw)
            requireLength(masterPw)
            if (unlockPw == masterPw) throw BoundariesException("SAME_PASSWORD", "The two passwords must be different")
            BoundariesPrefs.setPasswords(context, unlockPw, masterPw)
            true
        }

        AsyncFunction("verifyUnlockPassword") { pw: String -> BoundariesPrefs.verifyUnlockPassword(context, pw) }

        AsyncFunction("verifyMasterPassword") { pw: String -> BoundariesPrefs.verifyMasterPassword(context, pw) }

        AsyncFunction("changeUnlockPassword") { masterPw: String, newPw: String ->
            requireMaster(masterPw)
            requireLength(newPw)
            BoundariesPrefs.setUnlockPassword(context, newPw)
            true
        }

        AsyncFunction("changeMasterPassword") { currentMasterPw: String, newPw: String ->
            requireMaster(currentMasterPw)
            requireLength(newPw)
            BoundariesPrefs.setMasterPassword(context, newPw)
            true
        }

        // ---- Apps and rules ----

        AsyncFunction("getInstalledApps") { listInstalledApps() }

        /** All rules as a JSON array (see AppRule.toJson for the shape). */
        AsyncFunction("getRules") { AppRule.listToJson(BoundariesPrefs.getRules(context).values) }

        /** Replaces all rules. Password checks for loosening a rule happen in the UI first. */
        AsyncFunction("setRules") { json: String ->
            BoundariesPrefs.setRules(context, AppRule.listFromJson(json))
            SessionExpiryScheduler.scheduleNext(
                context,
                UsageTracker.nextTimedSessionExpiry(context, System.currentTimeMillis(), BoundariesPrefs.getRules(context)),
            )
            true
        }

        /** Today's usage per app as JSON: {pkg: {usedMs, opens, sessionUsedMs, sessionActive}}. */
        AsyncFunction("getUsageToday") { UsageTracker.todayJson(context) }

        // ---- Enforcement state ----

        AsyncFunction("getEnforcementState") {
            val until = BoundariesPrefs.getPausedUntil(context)
            mapOf(
                "active" to BoundariesPrefs.isEnforcementActive(context),
                "indefinitelyDisabled" to BoundariesPrefs.isIndefinitelyDisabled(context),
                "pausedUntil" to if (until > System.currentTimeMillis()) until.toDouble() else 0.0,
            )
        }

        AsyncFunction("pauseWithUnlockPassword") { unlockPw: String ->
            if (!BoundariesPrefs.verifyUnlockPassword(context, unlockPw)) throw BoundariesException("BAD_PASSWORD", "Password incorrect")
            val until = System.currentTimeMillis() + BoundariesPrefs.PAUSE_DURATION_MS
            BoundariesPrefs.setIndefinitelyDisabled(context, false)
            BoundariesPrefs.setPausedUntil(context, until)
            BoundaryResumeAlarm.scheduleResume(context, until)
            BoundaryCountdownNotification.clear(context)
            until.toDouble()
        }

        AsyncFunction("disableWithMasterPassword") { masterPw: String ->
            if (!BoundariesPrefs.verifyMasterPassword(context, masterPw)) throw BoundariesException("BAD_PASSWORD", "Master password incorrect")
            BoundaryResumeAlarm.cancelResume(context)
            BoundariesPrefs.setPausedUntil(context, 0L)
            BoundariesPrefs.setIndefinitelyDisabled(context, true)
            BoundaryCountdownNotification.clear(context)
            true
        }

        AsyncFunction("enable") {
            BoundaryResumeAlarm.cancelResume(context)
            BoundariesPrefs.setIndefinitelyDisabled(context, false)
            BoundariesPrefs.setPausedUntil(context, 0L)
            SessionExpiryScheduler.scheduleNext(
                context,
                UsageTracker.nextTimedSessionExpiry(context, System.currentTimeMillis(), BoundariesPrefs.getRules(context)),
            )
            true
        }

        // ---- Accessibility service ----

        AsyncFunction("isAccessibilityServiceEnabled") { isAccessibilityServiceEnabled() }

        AsyncFunction("openAccessibilitySettings") {
            startActivityPreferringCurrentActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        /** Resolves true if Shizuku switched the service on, false if Shizuku isn't available or granted. */
        AsyncFunction("enableAccessibilityViaShizuku") { promise: Promise ->
            val component = ComponentName(context, BoundariesAccessibilityService::class.java)
            ShizukuBridge.enableAccessibilityService(component.flattenToString()) { ok -> promise.resolve(ok) }
        }

        // ---- Media control (optional: pauses a timed-out app's own audio) ----

        AsyncFunction("isMediaControlAllowed") { BoundariesMediaListener.isAllowed(context) }

        AsyncFunction("openMediaControlSettings") {
            val component = BoundariesMediaListener.component(context)
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                    .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
            } else {
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            }
            startActivityPreferringCurrentActivity(intent)
        }

        AsyncFunction("allowMediaControlViaShizuku") { promise: Promise ->
            val component = BoundariesMediaListener.component(context)
            ShizukuBridge.allowNotificationListener(component.flattenToString()) { ok -> promise.resolve(ok) }
        }

        // ---- Device admin ----

        AsyncFunction("isDeviceAdminActive") { isDeviceAdminActive() }

        AsyncFunction("requestDeviceAdmin") {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, ComponentName(context, BoundariesAdminReceiver::class.java))
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Claritard uses device admin so removing your boundaries by uninstalling takes deliberate effort."
                )
            }
            startActivityPreferringCurrentActivity(intent)
        }

        // ---- Shizuku (optional: lets an app actually be force-stopped, not just sent home) ----

        AsyncFunction("isShizukuRunning") { ShizukuBridge.isShizukuInstalled() }

        AsyncFunction("isShizukuPermissionGranted") { ShizukuBridge.isPermissionGranted() }

        AsyncFunction("requestShizukuPermission") { ShizukuBridge.requestPermission() }

        // ---- Misc ----


        /** {surface, text, accent} as #RRGGBB, used for the messages the service draws. */
        AsyncFunction("setAppearance") { json: String -> BoundaryAppearance.save(context, json) }

        AsyncFunction("openAppSettings") {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:" + context.packageName)
            }
            startActivityPreferringCurrentActivity(intent)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = ComponentName(context, BoundariesAccessibilityService::class.java)
        val setting = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(setting)
        while (splitter.hasNext()) {
            if (ComponentName.unflattenFromString(splitter.next()) == expected) return true
        }
        return false
    }

    private fun isDeviceAdminActive(): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isAdminActive(ComponentName(context, BoundariesAdminReceiver::class.java))
    }

    private fun listInstalledApps(): List<Map<String, String>> {
        val pm = context.packageManager
        val launcherIntent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
        val seen = HashSet<String>()
        val result = ArrayList<Map<String, String>>()
        for (info in pm.queryIntentActivities(launcherIntent, 0)) {
            val packageName = info.activityInfo.packageName
            if (packageName == context.packageName || !seen.add(packageName)) continue
            val appInfo = info.activityInfo.applicationInfo
            val app = mutableMapOf("packageName" to packageName, "appName" to pm.getApplicationLabel(appInfo).toString())
            try {
                app["icon"] = drawableToBase64(pm.getApplicationIcon(appInfo))
            } catch (e: Exception) {
                android.util.Log.w("Boundaries", "No icon for $packageName", e)
            }
            result.add(app)
        }
        return result
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            Bitmap.createScaledBitmap(drawable.bitmap, ICON_SIZE_PX, ICON_SIZE_PX, true)
        } else {
            Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888).also {
                val canvas = Canvas(it)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
            }
        }
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }
}
