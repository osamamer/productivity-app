package org.osama.solife.boundaries

import android.content.ComponentName
import android.content.Context
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import rikka.shizuku.Shizuku
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Thin wrapper around the Shizuku API for the one thing this app uses it for: running
 * `am force-stop <package>` with adb-shell-level privilege. That's the only non-root way (short
 * of full Device Owner/MDM enrollment, which needs a factory reset) for a normal Android app to
 * actually force-stop another app's process and have its task disappear from the Recents/
 * app-switcher list - killBackgroundProcesses() alone does neither reliably, and a synthetic
 * swipe-to-dismiss gesture on the Recents UI (tried first) proved unreliable on a real device.
 *
 * Entirely optional: if Shizuku isn't installed or hasn't been granted permission, every call
 * here is a safe no-op and blocking still works via the accessibility service alone, just
 * without the extra force-stop.
 *
 * IMPORTANT (found 2026-09-21 after a real on-device freeze): Shizuku.pingBinder() and
 * Shizuku.checkSelfPermission() are synchronous Binder IPC calls into Shizuku's own process.
 * Native module calls share background threads - so if Shizuku's process is stuck (e.g. mid-ANR),
 * a plain blocking call to pingBinder()/checkSelfPermission() can hang that thread, which then
 * freezes other unrelated native calls queued behind it, including ones like
 * verifyMasterPassword(). This happened in Guard Bear, the app this code comes from: a Shizuku
 * ANR froze the Change Password screen, which never touches Shizuku at all. Every
 * call here that can reach Shizuku's Binder is therefore run on a dedicated background executor
 * with a hard timeout, so the calling thread is blocked for at most [CALL_TIMEOUT_MS], never
 * indefinitely - and forceStopPackage() (called from the accessibility service's hot path) is
 * fire-and-forget and never waits at all.
 */
object ShizukuBridge {

    private const val TAG = "ShizukuBridge"
    private const val PERMISSION_REQUEST_CODE = 411
    private const val CALL_TIMEOUT_MS = 800L
    private const val STOP_REQUEST_LIFETIME_MS = 20_000L

    // Cached pool, not a single thread: if one call genuinely hangs forever on a dead Binder,
    // it just leaks that one thread - it must never block later calls from getting a fresh one.
    private val ioExecutor = Executors.newCachedThreadPool()

    private fun <T> withTimeout(default: T, block: () -> T): T {
        return try {
            ioExecutor.submit(Callable { block() }).get(CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        } catch (e: Throwable) {
            Log.d(TAG, "withTimeout: Shizuku call timed out or failed, using default", e)
            default
        }
    }

    @Volatile private var userService: IBoundariesShellService? = null
    @Volatile private var packageName: String? = null
    @Volatile private var binding = false
    @Volatile private var initialized = false
    private val pendingStops = HashMap<String, Long>()

    private val userServiceArgs by lazy {
        Shizuku.UserServiceArgs(ComponentName(packageName ?: error("ShizukuBridge.initialize was not called"), BoundariesShellService::class.java.name))
            .daemon(false)
            .processNameSuffix("boundaries_shell")
            .debuggable(false)
            .version(3) // Bump whenever the AIDL changes so Shizuku restarts a stale service.
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            userService = if (binder.pingBinder()) IBoundariesShellService.Stub.asInterface(binder) else null
            binding = false
            dispatchPendingStops()
        }

        override fun onServiceDisconnected(name: ComponentName) {
            userService = null
            binding = false
        }
    }

    /** Call once, early in the process (application onCreate). Safe to call more than once. */
    fun initialize(context: Context) {
        if (initialized) return
        initialized = true
        packageName = context.packageName
        try {
            Shizuku.addBinderReceivedListenerSticky { ensureBound() }
            Shizuku.addBinderDeadListener { userService = null }
            Shizuku.addRequestPermissionResultListener { _, grantResult ->
                if (grantResult == PackageManager.PERMISSION_GRANTED) ensureBound()
            }
        } catch (e: Throwable) {
            Log.d(TAG, "initialize: Shizuku not available", e)
        }
    }

    /** Bounded by [CALL_TIMEOUT_MS] - never blocks the caller indefinitely even if Shizuku is hung. */
    fun isShizukuInstalled(): Boolean = withTimeout(false) {
        try {
            Shizuku.pingBinder()
        } catch (e: Throwable) {
            false
        }
    }

    /** Bounded by [CALL_TIMEOUT_MS] - never blocks the caller indefinitely even if Shizuku is hung. */
    fun isPermissionGranted(): Boolean = withTimeout(false) {
        try {
            Shizuku.pingBinder() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        } catch (e: Throwable) {
            false
        }
    }

    fun requestPermission() {
        ioExecutor.execute {
            try {
                if (Shizuku.pingBinder() && Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                    Shizuku.requestPermission(PERMISSION_REQUEST_CODE)
                }
            } catch (e: Throwable) {
                Log.d(TAG, "requestPermission: Shizuku not available", e)
            }
        }
    }

    fun ensureBound() {
        if (binding || userService != null) return
        binding = true
        ioExecutor.execute {
            try {
                if (!isPermissionGrantedBlocking()) {
                    binding = false
                    return@execute
                }
                Shizuku.bindUserService(userServiceArgs, connection)
            } catch (e: Throwable) {
                binding = false
                Log.d(TAG, "ensureBound: bindUserService failed", e)
            }
        }
    }

    /** Raw, unbounded check - only ever called from inside an already-backgrounded task. */
    private fun isPermissionGrantedBlocking(): Boolean = try {
        Shizuku.pingBinder() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (e: Throwable) {
        false
    }

    /** Queue a recent stop until the privileged service binds, without blocking accessibility. */
    fun forceStopPackage(packageName: String) {
        synchronized(pendingStops) {
            pendingStops[packageName] = SystemClock.elapsedRealtime() + STOP_REQUEST_LIFETIME_MS
        }
        dispatchPendingStops()
    }

    private fun dispatchPendingStops() {
        val service = userService
        if (service == null) {
            ensureBound()
            return
        }
        val now = SystemClock.elapsedRealtime()
        val requests = synchronized(pendingStops) {
            val ready = pendingStops.filterValues { it > now }.toMap()
            pendingStops.clear()
            ready
        }
        if (requests.isEmpty()) return
        ioExecutor.execute {
            for ((packageName, expiry) in requests) {
                try {
                    if (!service.forceStopPackage(packageName)) {
                        Log.w(TAG, "forceStopPackage: privileged command failed for $packageName")
                    }
                } catch (e: Throwable) {
                    Log.w(TAG, "forceStopPackage: call failed for $packageName; rebinding", e)
                    synchronized(pendingStops) {
                        if (SystemClock.elapsedRealtime() < expiry) pendingStops[packageName] = expiry
                    }
                    userService = null
                    ensureBound()
                }
            }
        }
    }

    /**
     * Turns on this app's accessibility service via the Shizuku shell process. Runs on the
     * background executor and reports back through [onResult] (true = enabled), so the caller
     * never blocks. Binds the user service first if needed, waiting a few seconds at most.
     */
    fun enableAccessibilityService(flattenedComponent: String, onResult: (Boolean) -> Unit) =
        withBoundService(onResult) { it.enableAccessibilityService(flattenedComponent) }

    /** Allows the media listener, reporting through [onResult] like [enableAccessibilityService]. */
    fun allowNotificationListener(flattenedComponent: String, onResult: (Boolean) -> Unit) =
        withBoundService(onResult) { it.allowNotificationListener(flattenedComponent) }

    private fun withBoundService(onResult: (Boolean) -> Unit, call: (IBoundariesShellService) -> Boolean) {
        ioExecutor.execute {
            val ok = try {
                if (!isPermissionGrantedBlocking()) {
                    false
                } else {
                    ensureBound()
                    var service = userService
                    val deadline = System.currentTimeMillis() + BIND_WAIT_MS
                    while (service == null && System.currentTimeMillis() < deadline) {
                        Thread.sleep(100)
                        service = userService
                    }
                    service?.let(call) ?: false
                }
            } catch (e: Throwable) {
                Log.d(TAG, "Shizuku shell call failed", e)
                userService = null
                false
            }
            onResult(ok)
        }
    }

    private const val BIND_WAIT_MS = 5000L
}
