package org.osama.solife.boundaries

import android.accessibilityservice.AccessibilityService
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * "A moment before <app>": a full-screen countdown drawn over a locked app, matching the desktop
 * app's countdown window. It covers the app and swallows touches until the user cancels or the
 * app unlocks. The service hides it whenever the app leaves the foreground or the screen turns
 * off, which is the phone's version of the desktop rule that the countdown only runs while its
 * window is focused.
 *
 * Hiding with [hide] remembers the countdown for [RESUME_GRACE_MS]: if the same app comes back
 * that quickly, [show] carries on from the same deadline instead of starting again. Foreground
 * detection flickers during app transitions, and without this each flicker restarted the wait.
 * [forget] drops the countdown for good (cancel, open, kick).
 *
 * While shown, the overlay keeps the screen on (for at most [READY_KEEP_ON_MS] once the countdown
 * is over), because a screen timeout during a long countdown would lock the phone and reset it.
 *
 * Timing lives here and in the service, not in anything the app being delayed can reach.
 */
class BoundaryDelayOverlay(
    private val service: AccessibilityService,
    private val onOpen: (pkg: String) -> Unit,
    private val onCancel: (pkg: String) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var root: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var state: State? = null
    private var remembered: Remembered? = null

    private class State(
        val pkg: String,
        val label: String,
        val totalMs: Long,
        val autoOpen: Boolean,
        val deadline: Long,
        val views: Views,
        var ready: Boolean = false,
        var readyAt: Long = 0,
        var opening: Boolean = false,
    )

    private class Views(val ring: RingView, val number: TextView, val caption: TextView, val openButton: TextView)

    private class Remembered(val pkg: String, val deadline: Long, val hiddenAt: Long)

    /** The package whose countdown is showing, or null. */
    val pkg: String? get() = state?.pkg

    private val tick = object : Runnable {
        override fun run() {
            val s = state ?: return
            try {
                render(s)
            } catch (e: Exception) {
                Log.w(TAG, "Countdown render failed", e)
            }
            if (state === s && s.keepTicking()) handler.postDelayed(this, TICK_MS)
        }
    }

    private fun State.keepTicking() = !ready || (params?.flags?.and(KEEP_ON) ?: 0) != 0

    /** Shows the countdown for [pkg]. Returns false if the overlay could not be added. */
    fun show(pkg: String, label: String, seconds: Int, message: String, autoOpen: Boolean): Boolean {
        val now = SystemClock.elapsedRealtime()
        val totalMs = seconds * 1000L
        val deadline = remembered
            ?.takeIf { it.pkg == pkg && now - it.hiddenAt <= RESUME_GRACE_MS }
            ?.deadline
            ?.coerceAtMost(now + totalMs)
            ?: (now + totalMs)
        removeView()
        remembered = null

        val colors = BoundaryAppearance.load(service)
        val layout = Layout.measure(service)
        val views = Views(
            ring = RingView(service, colors, layout.ringStrokePx),
            number = text(colors.text, 0f, bold = true).apply {
                setTextSize(TypedValue.COMPLEX_UNIT_PX, layout.ringPx * 0.4f)
                fontFeatureSettings = "tnum"
                gravity = Gravity.CENTER
                includeFontPadding = false
            },
            caption = text(colors.muted, 17f).apply {
                gravity = Gravity.CENTER
                minLines = 2
                setLineSpacing(0f, 1.15f)
            },
            openButton = button("Open $label", filled = true, colors = colors).apply {
                visibility = if (autoOpen) View.GONE else View.VISIBLE
                setOnClickListener { state?.takeIf { it.ready }?.let { open(it) } }
            },
        )
        val view = build(colors, layout, label, message.ifBlank { DEFAULT_MESSAGE }, views) { cancel(pkg) }
        val lp = layoutParams()
        return try {
            windowManager.addView(view, lp)
            root = view
            params = lp
            val s = State(pkg, label, totalMs, autoOpen, deadline, views)
            state = s
            view.alpha = 0f
            view.animate().alpha(1f).setDuration(FADE_MS).start()
            render(s)
            handler.removeCallbacks(tick)
            handler.postDelayed(tick, TICK_MS)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Could not show the delay overlay", e)
            state = null
            false
        }
    }

    /** Hides the countdown, remembering it briefly in case the same app comes straight back. */
    fun hide() {
        val s = state
        if (s != null && !s.opening) remembered = Remembered(s.pkg, s.deadline, SystemClock.elapsedRealtime())
        removeView()
    }

    /** Hides the countdown and drops it, so the next [show] starts from the beginning. */
    fun forget() {
        remembered = null
        removeView()
    }

    private fun removeView() {
        handler.removeCallbacks(tick)
        state = null
        params = null
        val view = root ?: return
        root = null
        try {
            windowManager.removeViewImmediate(view)
        } catch (e: Exception) {
            Log.w(TAG, "Could not remove the delay overlay", e)
        }
    }

    private fun open(s: State) {
        if (s.opening) return
        s.opening = true
        onOpen(s.pkg)
    }

    private fun cancel(pkg: String) {
        if (state?.pkg == pkg) onCancel(pkg)
    }

    private fun render(s: State) {
        val now = SystemClock.elapsedRealtime()
        val remainingMs = (s.deadline - now).coerceAtLeast(0)
        val v = s.views
        v.number.text = ((remainingMs + 999) / 1000).toString()
        v.ring.setFraction(if (s.totalMs > 0) remainingMs.toFloat() / s.totalMs else 0f)
        if (remainingMs > 0) {
            v.caption.text = if (s.autoOpen) {
                "${s.label} opens when the timer ends.\nLeaving starts it again."
            } else {
                "Then choose whether to open ${s.label}.\nLeaving starts it again."
            }
            v.openButton.isEnabled = false
            v.openButton.alpha = 0.4f
            return
        }
        if (!s.ready) {
            s.ready = true
            s.readyAt = now
            v.caption.text = "Ready when you are."
            v.openButton.isEnabled = true
            v.openButton.alpha = 1f
            if (s.autoOpen) {
                open(s)
                return
            }
        }
        if (now - s.readyAt >= READY_KEEP_ON_MS) allowScreenOff()
    }

    private fun allowScreenOff() {
        val view = root ?: return
        val lp = params ?: return
        if (lp.flags and KEEP_ON == 0) return
        lp.flags = lp.flags and KEEP_ON.inv()
        try {
            windowManager.updateViewLayout(view, lp)
        } catch (e: Exception) {
            Log.w(TAG, "Could not let the screen turn off", e)
        }
    }

    private fun dp(value: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, service.resources.displayMetrics).toInt()

    private fun text(color: Int, sizeSp: Float, bold: Boolean = false) = TextView(service).apply {
        setTextColor(color)
        if (sizeSp > 0f) setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        typeface = Typeface.create("sans-serif", if (bold) Typeface.BOLD else Typeface.NORMAL)
    }

    private fun button(label: String, filled: Boolean, colors: BoundaryAppearance.Colors) = TextView(service).apply {
        text = label
        gravity = Gravity.CENTER
        maxLines = 1
        ellipsize = android.text.TextUtils.TruncateAt.END
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(if (filled) colors.onAccent else colors.text)
        setPadding(dp(16f), 0, dp(16f), 0)
        minHeight = dp(58f)
        isClickable = true
        isFocusable = true
        background = GradientDrawable().apply {
            cornerRadius = dp(16f).toFloat()
            if (filled) setColor(colors.accent) else setStroke(dp(1.5f), colors.border)
        }
    }

    private fun build(
        colors: BoundaryAppearance.Colors,
        layout: Layout,
        label: String,
        message: String,
        views: Views,
        cancel: () -> Unit,
    ): View {
        val close = text(colors.muted, 30f).apply {
            text = "×"
            gravity = Gravity.CENTER
            contentDescription = "Cancel"
            isClickable = true
            setOnClickListener { cancel() }
        }
        val topBar = FrameLayout(service).apply {
            addView(close, FrameLayout.LayoutParams(dp(48f), dp(48f), Gravity.END or Gravity.CENTER_VERTICAL))
        }
        val eyebrow = text(colors.accent, 14f, bold = true).apply {
            text = "A moment before $label".uppercase()
            letterSpacing = 0.1f
            gravity = Gravity.CENTER
        }
        val headline = text(colors.text, 32f, bold = true).apply {
            text = message
            gravity = Gravity.CENTER
            letterSpacing = -0.01f
            setLineSpacing(0f, 1.05f)
        }
        val ringBox = FrameLayout(service).apply {
            addView(views.ring, FrameLayout.LayoutParams(layout.ringPx, layout.ringPx, Gravity.CENTER))
            addView(views.number, FrameLayout.LayoutParams(layout.ringPx, layout.ringPx, Gravity.CENTER))
        }
        val cancelButton = button("Cancel", filled = false, colors = colors).apply { setOnClickListener { cancel() } }
        val actions = LinearLayout(service).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(cancelButton, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            if (views.openButton.visibility == View.VISIBLE) {
                addView(views.openButton, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.4f).apply {
                    marginStart = dp(12f)
                })
            }
        }
        val column = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            addView(topBar, fullWidth())
            addView(View(service), weighted(0.8f))
            addView(eyebrow, fullWidth())
            addView(headline, fullWidth(top = dp(12f)))
            addView(ringBox, centred(top = dp(40f)))
            addView(views.caption, fullWidth(top = dp(32f)))
            addView(View(service), weighted(1f))
            addView(actions, fullWidth(top = dp(24f)))
        }
        val screen = FrameLayout(service).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(ColorUtils.blendARGB(colors.background, colors.accent, 0.12f), colors.background, colors.background),
            )
            isClickable = true
            addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        applyInsets(screen, layout.sidePx)
        return screen
    }

    /** Pads the content clear of the status bar, navigation bar and display cutout. */
    private fun applyInsets(view: View, sidePx: Int) {
        val minTop = dp(8f)
        val minBottom = dp(24f)
        view.setPadding(sidePx, dp(32f), sidePx, dp(48f))
        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(
                sidePx + bars.left,
                minTop + bars.top,
                sidePx + bars.right,
                minBottom + bars.bottom,
            )
            insets
        }
    }

    private fun fullWidth(top: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = top }

    private fun centred(top: Int) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply {
        topMargin = top
        gravity = Gravity.CENTER_HORIZONTAL
    }

    private fun weighted(weight: Float) = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, weight)

    /**
     * Fills the whole display, status and navigation bar areas included, so the background runs
     * edge to edge like an app's. Accessibility overlays sit above the system bars, so the bars'
     * icons are covered while the countdown shows; [applyInsets] keeps the content clear of them.
     */
    private fun layoutParams() = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            KEEP_ON,
        PixelFormat.TRANSLUCENT,
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Without this the window is shrunk to the area between the system bars.
            fitInsetsTypes = 0
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }

    /** Sizes that depend on the screen: the ring takes most of the width on a phone. */
    private class Layout(val sidePx: Int, val ringPx: Int, val ringStrokePx: Float) {
        companion object {
            fun measure(context: Context): Layout {
                val metrics = context.resources.displayMetrics
                val density = metrics.density
                val side = (24 * density).toInt()
                val byWidth = (metrics.widthPixels - 2 * side) * 0.78f
                val byHeight = metrics.heightPixels * 0.34f
                val ring = minOf(byWidth, byHeight, 300 * density).toInt().coerceAtLeast((160 * density).toInt())
                return Layout(side, ring, ring * 0.045f)
            }
        }
    }

    /** The countdown ring: a faint track and an accent arc that shrinks as time runs out. */
    private class RingView(context: Context, colors: BoundaryAppearance.Colors, private val stroke: Float) : View(context) {
        private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            color = colors.track
        }
        private val progress = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            strokeCap = Paint.Cap.ROUND
            color = colors.accent
        }
        private val bounds = RectF()
        private var fraction = 1f
        private var target = -1f
        private var animator: ValueAnimator? = null

        fun setFraction(next: Float) {
            val clamped = next.coerceIn(0f, 1f)
            if (clamped == target) return
            target = clamped
            animator?.cancel()
            animator = ValueAnimator.ofFloat(fraction, clamped).apply {
                duration = TICK_MS
                interpolator = LinearInterpolator()
                addUpdateListener {
                    fraction = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        override fun onDetachedFromWindow() {
            animator?.cancel()
            super.onDetachedFromWindow()
        }

        override fun onDraw(canvas: Canvas) {
            val inset = stroke / 2
            bounds.set(inset, inset, width - inset, height - inset)
            canvas.drawOval(bounds, track)
            if (fraction > 0f) canvas.drawArc(bounds, -90f, 360f * fraction, false, progress)
        }
    }

    companion object {
        private const val TAG = "BoundaryDelay"
        private const val TICK_MS = 200L
        private const val FADE_MS = 160L
        private const val RESUME_GRACE_MS = 3_000L
        private const val READY_KEEP_ON_MS = 60_000L
        private const val KEEP_ON = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        const val DEFAULT_MESSAGE = "Take a breath."
    }
}
