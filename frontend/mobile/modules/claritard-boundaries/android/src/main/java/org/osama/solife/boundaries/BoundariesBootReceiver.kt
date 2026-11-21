package org.osama.solife.boundaries

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts the foreground service after a reboot, and re-arms any pending resume alarm. */
class BoundariesBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!BoundariesPrefs.hasPasswordsSet(context)) return

        BoundariesForegroundService.start(context)

        val pausedUntil = BoundariesPrefs.getPausedUntil(context)
        if (pausedUntil > System.currentTimeMillis()) {
            BoundariesForegroundService.scheduleResume(context, pausedUntil)
        }
        SessionExpiryScheduler.scheduleNext(
            context,
            UsageTracker.nextTimedSessionExpiry(context, System.currentTimeMillis(), BoundariesPrefs.getRules(context)),
        )
    }
}
