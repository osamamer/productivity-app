package org.osama.solife.boundaries

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired by AlarmManager five minutes after a pause. Turns enforcement back on. */
class AutoResumeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BoundariesPrefs.setPausedUntil(context, 0L)
        SessionExpiryScheduler.scheduleNext(
            context,
            UsageTracker.nextTimedSessionExpiry(context, System.currentTimeMillis(), BoundariesPrefs.getRules(context)),
        )
        BoundariesForegroundService.refreshNotification(context)
    }
}
