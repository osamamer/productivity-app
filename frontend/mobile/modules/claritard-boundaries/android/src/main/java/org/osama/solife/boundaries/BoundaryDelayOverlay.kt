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
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils

/**
 * "A moment before <app>": a full-screen countdown drawn over a locked app, matching the desktop
 * app's countdown window. It covers the app and swallows touches until the user cancels or the
 * app unlocks. The countdown runs from when it is shown; the service hides it (resetting the
 * countdown) whenever the app leaves the foreground or the screen turns off, which is the phone's
 * version of the desktop rule that the countdown only runs while its window is focused.
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
    private var state: State? = null

    private class State(
        val pkg: String,
        val label: String,
        val totalMs: Long,
        val autoOpen: Boolean,
        val deadline: Long,
        val ring: RingView,
        val number: TextView,
        val caption: TextView,
        val openButton: TextView,
        var ready: Boolean = false,
    )

    /** The package whose countdown is showing, or null. */
    val pkg: String? get() = state?.pkg

    private val tick = object : Runnable {
        override fun run() {
            val s = state ?: return
            render(s)
            if (!s.ready) handler.postDelayed(this, TICK_MS)
        }
    }

    /** Shows the countdown for [pkg]. Returns false if the overlay could not be added. */
    fun show(pkg: String, label: String, seconds: Int, message: String, autoOpen: Boolean): Boolean {
        hide()
        val colors = BoundaryAppearance.load(service)
        val ring = RingView(service, colors)
        val number = text(colors.text, 52f, bold = true).apply {
            fontFeatureSettings = "tnum"
            gravity = Gravity.CENTER
        }
        val caption = text(colors.muted, 14f).apply {
            gravity = Gravity.CENTER
            minLines = 2
        }
        val openButton = button("Open $label", filled = true, colors = colors).apply {
            visibility = if (autoOpen) View.GONE else View.VISIBLE
            setOnClickListener { state?.takeIf { it.ready }?.let { onOpen(it.pkg) } }
        }
        val view = build(colors, label, message.ifBlank { DEFAULT_MESSAGE }, ring, number, caption, openButton) { onCancel(pkg) }
        return try {
            windowManager.addView(view, layoutParams())
            root = view
            val s = State(pkg, label, seconds * 1000L, autoOpen, SystemClock.elapsedRealtime() + seconds * 1000L, ring, number, caption, openButton)
            state = s
            view.alpha = 0f
            view.animate().alpha(1f).setDuration(FADE_MS).start()
            render(s)
            handler.postDelayed(tick, TICK_MS)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Could not show the delay overlay", e)
            false
        }
    }

    fun hide() {
        handler.removeCallbacks(tick)
        state = null
        val view = root ?: return
        root = null
        try {
            windowManager.removeView(view)
        } catch (e: Exception) {
            Log.w(TAG, "Could not remove the delay overlay", e)
        }
    }

    private fun render(s: State) {
        val remainingMs = (s.deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0)
        val seconds = ((remainingMs + 999) / 1000).toInt()
        s.number.text = seconds.toString()
        s.ring.setFraction(if (s.totalMs > 0) remainingMs.toFloat() / s.totalMs else 0f)
        if (remainingMs > 0) {
            s.caption.text = if (s.autoOpen) {
                "${s.label} opens after the countdown. Leaving starts it again."
            } else {
                "Wait, then choose whether to open ${s.label}. Leaving starts it again."
            }
            s.openButton.isEnabled = false
            s.openButton.alpha = 0.4f
            return
        }
        s.ready = true
        s.caption.text = "Ready when you are."
        s.openButton.isEnabled = true
        s.openButton.alpha = 1f
        if (s.autoOpen) onOpen(s.pkg)
    }

    private fun dp(value: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, service.resources.displayMetrics).toInt()

    private fun text(color: Int, sizeSp: Float, bold: Boolean = false) = TextView(service).apply {
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        typeface = if (bold) Typeface.create("sans-serif", Typeface.BOLD) else Typeface.create("sans-serif", Typeface.NORMAL)
    }

    private fun button(label: String, filled: Boolean, colors: BoundaryAppearance.Colors) = TextView(service).apply {
        text = label
        gravity = Gravity.CENTER
        maxLines = 1
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(if (filled) colors.onAccent else colors.muted)
        setPadding(dp(20f), 0, dp(20f), 0)
        minHeight = dp(50f)
        isClickable = true
        isFocusable = true
        background = GradientDrawable().apply {
            cornerRadius = dp(14f).toFloat()
            if (filled) setColor(colors.accent) else setStroke(dp(1f), colors.border)
        }
    }

    private fun build(
        colors: BoundaryAppearance.Colors,
        label: String,
        message: String,
        ring: RingView,
        number: TextView,
        caption: TextView,
        openButton: TextView,
        cancel: () -> Unit,
    ): View {
        val eyebrow = text(colors.accent, 12f, bold = true).apply {
            text = "A moment before $label".uppercase()
            letterSpacing = 0.08f
            gravity = Gravity.CENTER
        }
        val headline = text(colors.text, 24f, bold = true).apply {
            text = message
            gravity = Gravity.CENTER
            letterSpacing = -0.01f
        }
        val ringBox = FrameLayout(service).apply {
            addView(ring, FrameLayout.LayoutParams(dp(RING_DP), dp(RING_DP)))
            addView(number, FrameLayout.LayoutParams(dp(RING_DP), dp(RING_DP)))
        }
        val centre = LinearLayout(service).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            addView(eyebrow)
            addView(headline, spaced(dp(10f)))
            addView(ringBox, spaced(dp(36f)))
            addView(caption, spaced(dp(28f)))
        }
        val cancelButton = button("Cancel", filled = false, colors = colors).apply { setOnClickListener { cancel() } }
        val actions = LinearLayout(service).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(cancelButton, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(openButton, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.4f).apply { marginStart = dp(12f) })
        }
        val close = text(colors.muted, 26f).apply {
            text = "×"
            gravity = Gravity.CENTER
            contentDescription = "Cancel"
            isClickable = true
            setOnClickListener { cancel() }
        }
        return FrameLayout(service).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(ColorUtils.blendARGB(colors.background, colors.accent, 0.12f), colors.background, colors.background),
            )
            isClickable = true
            setPadding(dp(28f), dp(48f), dp(28f), dp(40f))
            addView(close, FrameLayout.LayoutParams(dp(44f), dp(44f), Gravity.TOP or Gravity.END))
            addView(centre, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER,
            ))
            addView(actions, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM,
            ))
        }
    }

    private fun spaced(top: Int) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
        topMargin = top
        gravity = Gravity.CENTER_HORIZONTAL
    }

    private fun layoutParams() = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
    )

    /** The countdown ring: a faint track and an accent arc that shrinks as time runs out. */
    private class RingView(context: Context, colors: BoundaryAppearance.Colors) : View(context) {
        private val stroke = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 8f, context.resources.displayMetrics)
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
        private var animator: ValueAnimator? = null

        fun setFraction(next: Float) {
            animator?.cancel()
            animator = ValueAnimator.ofFloat(fraction, next.coerceIn(0f, 1f)).apply {
                duration = TICK_MS
                interpolator = LinearInterpolator()
                addUpdateListener {
                    fraction = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
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
        private const val RING_DP = 168f
        const val DEFAULT_MESSAGE = "Take a breath."
    }
}
