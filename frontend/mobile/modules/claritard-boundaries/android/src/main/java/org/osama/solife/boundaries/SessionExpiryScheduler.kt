package org.osama.solife.boundaries

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

/** Wakes enforcement for a timed open even when its app is playing audio behind a locked screen. */
object SessionExpiryScheduler {
    private const val REQUEST_CODE = 4244

    fun scheduleNext(context: Context, atMillis: Long?) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, SessionExpiryReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        alarmManager.cancel(pendingIntent)
        if (atMillis != null) {
            // This API remains available without the exact-alarm permission. The accessibility
            // service's one-second ticker handles the normal case; this alarm is the sleep fallback.
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                maxOf(atMillis, System.currentTimeMillis() + 1_000L),
                pendingIntent,
            )
        }
    }
}

class SessionExpiryReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!BoundariesPrefs.isEnforcementActive(context)) return
        val now = System.currentTimeMillis()
        val rules = BoundariesPrefs.getRules(context)
        val expired = UsageTracker.expireTimedSessions(context, now, rules)
        SessionExpiryScheduler.scheduleNext(context, UsageTracker.nextTimedSessionExpiry(context, now, rules))
        if (expired.isEmpty()) return

        ShizukuBridge.initialize(context)
        for (pkg in expired) AppStopper.stop(context, pkg)
        // Keep the process awake while Shizuku binds and the stop requests go out.
        val pending = goAsync()
        Handler(Looper.getMainLooper()).postDelayed({ pending.finish() }, STOP_GRACE_MS)
    }

    private companion object {
        const val STOP_GRACE_MS = 5_000L
    }
}
