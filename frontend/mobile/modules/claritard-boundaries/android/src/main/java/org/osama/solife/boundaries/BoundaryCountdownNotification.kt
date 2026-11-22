package org.osama.solife.boundaries

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import kotlin.math.abs

/** Android renders the remaining time itself, including while the screen is locked. */
object BoundaryCountdownNotification {
    private const val CHANNEL = "claritard_boundaries_countdown"
    private const val NOTIFICATION_ID = 4242
    private val posted = mutableMapOf<String, Long>()

    @Synchronized
    fun update(context: Context, deadlines: Map<String, Long>, labelFor: (String) -> String) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        for (pkg in posted.keys.filterNot(deadlines::containsKey)) {
            manager.cancel(pkg, NOTIFICATION_ID)
            posted.remove(pkg)
        }
        if (deadlines.isEmpty() || !manager.areNotificationsEnabled()) return
        if (Build.VERSION.SDK_INT >= 33
            && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

        if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL) == null) {
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL, "App limit countdowns", NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) })
        }
        val now = System.currentTimeMillis()
        for ((pkg, deadline) in deadlines) {
            if (deadline <= now || posted[pkg]?.let { abs(it - deadline) < 1_500L } == true) continue
            val notification = NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentTitle("${labelFor(pkg)} closes in")
                .setWhen(deadline)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setTimeoutAfter(deadline - now)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
            manager.notify(pkg, NOTIFICATION_ID, notification)
            posted[pkg] = deadline
        }
    }

    fun clear(context: Context) = update(context, emptyMap()) { it }
}
