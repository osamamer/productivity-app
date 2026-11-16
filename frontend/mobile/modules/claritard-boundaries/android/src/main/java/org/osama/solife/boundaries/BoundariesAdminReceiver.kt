package org.osama.solife.boundaries

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Makes Claritard a Device Administrator. This doesn't let the app veto an uninstall outright
 * (that needs full Device Owner/MDM enrollment) but it forces the user through Settings >
 * Security > Device admin apps before Android will let them uninstall at all - a real speed
 * bump, not a guarantee. The accessibility service's uninstall guard is what tries to intercept
 * that Settings screen.
 */
class BoundariesAdminReceiver : DeviceAdminReceiver() {
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Removing admin rights will make it possible to uninstall Claritard and drop your boundaries."
    }
}
