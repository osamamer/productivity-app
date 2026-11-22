package org.osama.solife.boundaries

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restores pending enforcement alarms after reboot. */
class BoundariesBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!BoundariesPrefs.hasPasswordsSet(context)) return


        val pausedUntil = BoundariesPrefs.getPausedUntil(context)
        if (pausedUntil > System.currentTimeMillis()) {
            BoundaryResumeAlarm.scheduleResume(context, pausedUntil)
        }
        SessionExpiryScheduler.scheduleNext(
            context,
            UsageTracker.nextTimedSessionExpiry(context, System.currentTimeMillis(), BoundariesPrefs.getRules(context)),
        )
    }
}
