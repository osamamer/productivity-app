package org.osama.solife.boundaries

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

object BoundaryResumeAlarm {
    private const val ALARM_REQUEST_CODE = 4243

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
