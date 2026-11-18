package org.osama.solife.boundaries

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

/**
 * The colors the app's theme last reported, so messages drawn by the accessibility service
 * match Claritard even when its JavaScript is not running. Plain preferences: nothing secret.
 */
object BoundaryAppearance {
    private const val PREFS = "boundaries_appearance"
    private const val KEY = "appearance"

    data class Colors(val surface: Int, val text: Int, val accent: Int, val background: Int, val onAccent: Int) {
        val muted: Int get() = (text and 0x00FFFFFF) or 0xB3000000.toInt()
        val track: Int get() = (text and 0x00FFFFFF) or 0x17000000
        val border: Int get() = (text and 0x00FFFFFF) or 0x24000000
    }

    private val fallback = Colors(
        surface = Color.parseColor("#30343A"),
        text = Color.WHITE,
        accent = Color.parseColor("#A395F2"),
        background = Color.parseColor("#1E2124"),
        onAccent = Color.parseColor("#111827"),
    )

    private fun color(o: JSONObject, key: String, otherwise: Int): Int =
        o.optString(key).takeIf { it.isNotEmpty() }?.let(Color::parseColor) ?: otherwise

    fun save(context: Context, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun load(context: Context): Colors {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return fallback
        return try {
            val o = JSONObject(raw)
            Colors(
                surface = Color.parseColor(o.optString("surface")),
                text = Color.parseColor(o.optString("text")),
                accent = Color.parseColor(o.optString("accent")),
                // Absent in what versions before the delay overlay stored.
                background = color(o, "background", fallback.background),
                onAccent = color(o, "onAccent", fallback.onAccent),
            )
        } catch (e: Exception) {
            Log.w("BoundaryAppearance", "Stored appearance is unreadable; using the default", e)
            fallback
        }
    }
}

/**
 * A toast-like message in Claritard's colors, drawn as an accessibility overlay (which needs no
 * extra permission). Falls back to a system toast if the overlay cannot be added.
 */
class BoundaryToast(private val service: AccessibilityService) {
    private val handler = Handler(Looper.getMainLooper())
    private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var current: View? = null
    private val hide = Runnable { remove() }

    fun show(message: String) {
        handler.post {
            remove()
            try {
                val view = build(message)
                windowManager.addView(view, layoutParams())
                current = view
                view.alpha = 0f
                view.animate().alpha(1f).setDuration(FADE_MS).start()
                handler.postDelayed(hide, VISIBLE_MS)
            } catch (e: Exception) {
                Log.w("BoundaryToast", "Overlay unavailable; using a system toast", e)
                Toast.makeText(service.applicationContext, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun remove() {
        handler.removeCallbacks(hide)
        val view = current ?: return
        current = null
        try {
            windowManager.removeView(view)
        } catch (e: Exception) {
            Log.w("BoundaryToast", "Could not remove the overlay", e)
        }
    }

    private fun dp(value: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, service.resources.displayMetrics).toInt()

    private fun build(message: String): View {
        val colors = BoundaryAppearance.load(service)
        val accentBar = View(service).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(2f).toFloat()
                setColor(colors.accent)
            }
            layoutParams = LinearLayout.LayoutParams(dp(4f), LinearLayout.LayoutParams.MATCH_PARENT).apply { marginEnd = dp(12f) }
        }
        val text = TextView(service).apply {
            this.text = message
            setTextColor(colors.text)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            maxLines = 3
        }
        return LinearLayout(service).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(14f), dp(14f), dp(18f), dp(14f))
            background = GradientDrawable().apply {
                cornerRadius = dp(20f).toFloat()
                setColor(colors.surface)
                setStroke(dp(1f), (colors.accent and 0x00FFFFFF) or 0x55000000)
            }
            elevation = dp(6f).toFloat()
            addView(accentBar)
            addView(text)
        }
    }

    private fun layoutParams() = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        y = dp(96f)
        width = WindowManager.LayoutParams.WRAP_CONTENT
    }

    companion object {
        private const val VISIBLE_MS = 3500L
        private const val FADE_MS = 160L
    }
}
