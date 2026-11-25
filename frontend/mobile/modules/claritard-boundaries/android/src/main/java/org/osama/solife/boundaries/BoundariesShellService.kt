package org.osama.solife.boundaries

import android.util.Log

/**
 * Runs in the separate, privileged process Shizuku spawns (adb-shell UID) once the user grants
 * this app permission via the Shizuku app. Shelling out to `am force-stop` here runs it with
 * that same shell identity - exactly what `adb shell am force-stop <pkg>` does - which is the
 * only non-root way to genuinely kill a blocked app's process and clear its Recents entry.
 *
 * Must have a public no-arg constructor - Shizuku instantiates this by reflection.
 */
class BoundariesShellService : IBoundariesShellService.Stub() {

    override fun destroy() {
        System.exit(0)
    }

    override fun forceStopPackage(packageName: String): Boolean {
        return try {
            val exitCode = Runtime.getRuntime().exec(arrayOf("am", "force-stop", packageName)).waitFor()
            if (exitCode != 0) Log.w("BoundariesShell", "force-stop failed for $packageName: exit=$exitCode")
            exitCode == 0
        } catch (e: Exception) {
            Log.w("BoundariesShell", "Could not force-stop $packageName", e)
            false
        }
    }

    /**
     * Same as `adb shell settings put secure enabled_accessibility_services ...`. Run with the
     * shell identity, this sidesteps the "Restricted setting" / Play Protect block Android puts
     * on sideloaded apps turning on accessibility through the Settings UI.
     */
    override fun enableAccessibilityService(flattenedComponent: String): Boolean {
        return try {
            val current = runForOutput("settings", "get", "secure", "enabled_accessibility_services")
                .takeUnless { it.isEmpty() || it == "null" } ?: ""
            val entries = current.split(':').filter { it.isNotBlank() }
            if (entries.none { it.equals(flattenedComponent, ignoreCase = true) }) {
                val updated = (entries + flattenedComponent).joinToString(":")
                Runtime.getRuntime()
                    .exec(arrayOf("settings", "put", "secure", "enabled_accessibility_services", updated))
                    .waitFor()
            }
            Runtime.getRuntime()
                .exec(arrayOf("settings", "put", "secure", "accessibility_enabled", "1"))
                .waitFor()
            runForOutput("settings", "get", "secure", "enabled_accessibility_services")
                .split(':')
                .any { it.equals(flattenedComponent, ignoreCase = true) }
        } catch (e: Exception) {
            false
        }
    }

    /** Like [enableAccessibilityService], it sidesteps the "Restricted setting" block. */
    override fun allowNotificationListener(flattenedComponent: String): Boolean {
        return try {
            val exitCode = Runtime.getRuntime()
                .exec(arrayOf("cmd", "notification", "allow_listener", flattenedComponent))
                .waitFor()
            exitCode == 0
        } catch (e: Exception) {
            Log.w("BoundariesShell", "Could not allow notification listener", e)
            false
        }
    }

    private fun runForOutput(vararg cmd: String): String {
        val process = Runtime.getRuntime().exec(cmd)
        val out = process.inputStream.bufferedReader().readText().trim()
        process.waitFor()
        return out
    }
}
