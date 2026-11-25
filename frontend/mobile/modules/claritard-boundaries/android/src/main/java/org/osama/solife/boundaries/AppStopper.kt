package org.osama.solife.boundaries

import android.app.ActivityManager
import android.content.Context
import android.util.Log
import java.util.Calendar

/**
 * Shuts an app down when it is blocked or its time runs out: stops its audio, then force-stops it.
 * Force-stopping needs Shizuku; without it the process may keep running, so stopped apps are
 * remembered and [silenceStragglers] pauses them again if they start playing (for example from
 * their media notification) before they are unlocked again.
 */
object AppStopper {
    private const val TAG = "AppStopper"
    private val stopped = HashSet<String>()

    fun stop(context: Context, pkg: String) {
        MediaStopper.stop(context, pkg)
        killBackgroundProcess(context, pkg)
        ShizukuBridge.forceStopPackage(pkg)
        synchronized(stopped) { stopped.add(pkg) }
    }

    /** Called every tick. Needs media control to tell which app is playing; a no-op without it. */
    fun silenceStragglers(context: Context, now: Long, rules: Map<String, AppRule>) {
        val candidates = synchronized(stopped) { stopped.toList() }
        if (candidates.isEmpty()) return
        val calendar = Calendar.getInstance().apply { timeInMillis = now }
        for (pkg in candidates) {
            val rule = rules[pkg]
            if (rule == null || !rule.limitsInForceAt(calendar) || UsageTracker.isUnlocked(context, rule, now)) {
                synchronized(stopped) { stopped.remove(pkg) }
            } else if (MediaStopper.isPlaying(context, pkg)) {
                stop(context, pkg)
            }
        }
    }

    /** Only reaps a cached process; Android 14+ refuses it for other apps entirely. */
    private fun killBackgroundProcess(context: Context, pkg: String) {
        try {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            manager.killBackgroundProcesses(pkg)
        } catch (e: Exception) {
            Log.w(TAG, "Could not stop background process $pkg", e)
        }
    }
}
