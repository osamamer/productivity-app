package org.osama.solife.boundaries

import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import androidx.core.app.NotificationManagerCompat

/**
 * Exists only so Android hands this app other apps' media sessions: MediaSessionManager lists
 * them for a caller whose notification listener the user has allowed. Notifications themselves
 * are ignored. See [MediaStopper].
 */
class BoundariesMediaListener : NotificationListenerService() {
    companion object {
        fun component(context: Context) = ComponentName(context, BoundariesMediaListener::class.java)

        fun isAllowed(context: Context): Boolean =
            NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }
}
