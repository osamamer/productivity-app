package org.osama.solife.boundaries

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Keeps a persistent low-priority notification up so the OS doesn't kill the process and the
 * user always has a visible "boundaries are on/paused/off" indicator. The actual enforcement
 * lives in BoundariesAccessibilityService and reads BoundariesPrefs directly, so this service
 * staying alive is a reliability aid, not a hard dependency of enforcement working.
 */
class BoundariesForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Boundaries status",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Shows whether your app boundaries are being enforced"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            data = android.net.Uri.parse("solife://boundaries")
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Boundaries")
            .setContentText(statusText(applicationContext))
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "claritard_boundaries_status"
        const val NOTIFICATION_ID = 4242
        private const val ALARM_REQUEST_CODE = 4243

        /**
         * Android refuses to start a foreground service from a process that was cold-started in
         * the background (e.g. woken for a broadcast), throwing
         * ForegroundServiceStartNotAllowedException, which is fatal if uncaught. The boot
         * receiver's call (an exempt BOOT_COMPLETED context) is the real path after a reboot;
         * this try/catch keeps any other, non-exempt caller from taking the process down.
         */
        fun start(context: Context) {
            val intent = Intent(context, BoundariesForegroundService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.w("BoundariesService", "start() not allowed right now, skipping", e)
            }
        }

        /** Re-posts the notification so its text reflects the latest state. */
        fun refreshNotification(context: Context) = start(context)

        fun statusText(context: Context): String {
            return when {
                BoundariesPrefs.isIndefinitelyDisabled(context) ->
                    "Off (master override) — open Claritard to turn them back on"
                BoundariesPrefs.getPausedUntil(context) > System.currentTimeMillis() ->
                    "Paused — back on automatically in a few minutes"
                else -> "Boundaries are on"
            }
        }

        fun scheduleResume(context: Context, atMillis: Long) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, resumePendingIntent(context))
        }

        fun cancelResume(context: Context) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.cancel(resumePendingIntent(context))
        }

        private fun resumePendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, AutoResumeReceiver::class.java)
            return PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }
    }
}
