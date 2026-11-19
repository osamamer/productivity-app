package org.osama.solife.boundaries

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * A time-of-day window on selected days of the week. [days] uses 0 = Sunday .. 6 = Saturday
 * (same as JS Date.getDay()). [startMin]/[endMin] are minutes since midnight. If end <= start
 * the window wraps past midnight (e.g. 22:00-06:00), and belongs to the day it *starts* on.
 * start == end means the whole day.
 */
data class TimeWindow(val days: Set<Int>, val startMin: Int, val endMin: Int) {

    fun contains(dayOfWeek: Int, minuteOfDay: Int): Boolean {
        if (startMin == endMin) return days.contains(dayOfWeek)
        if (startMin < endMin) {
            return days.contains(dayOfWeek) && minuteOfDay >= startMin && minuteOfDay < endMin
        }
        // Wraps past midnight.
        val prevDay = (dayOfWeek + 6) % 7
        return (days.contains(dayOfWeek) && minuteOfDay >= startMin) ||
            (days.contains(prevDay) && minuteOfDay < endMin)
    }

    fun toJson(): JSONObject = JSONObject()
        .put("days", JSONArray(days.sorted()))
        .put("start", startMin)
        .put("end", endMin)

    companion object {
        fun fromJson(o: JSONObject): TimeWindow {
            val arr = o.optJSONArray("days") ?: JSONArray()
            val days = HashSet<Int>()
            for (i in 0 until arr.length()) days.add(arr.optInt(i))
            return TimeWindow(days, o.optInt("start", 0).coerceIn(0, 1439), o.optInt("end", 0).coerceIn(0, 1439))
        }
    }
}

/**
 * Per-app restriction. All of it is optional and combinable:
 *  - [blockMode]: "off", "always", or "scheduled" (blocked completely during [blockWindows]).
 *  - Limits (0 = no limit): [dailyLimitMin] minutes of use per day, [maxOpens] opens per day,
 *    [sessionMin] minutes each open lasts (on the clock, from the unlock) before the app gets
 *    force-quit; reopening the app within it, even after a screen lock, is part of the same open.
 *  - [delaySeconds]: a countdown shown over the app before it unlocks (0 = none). It only runs
 *    while the app stays in front with the screen on, and starts again from the top otherwise.
 *    With [delayAutoOpen] the app unlocks when it ends; without, the user taps Open. [delayMessage]
 *    is shown above the countdown (blank = a default).
 *  - [limitWindows]: when the limits and the delay apply. Empty = all the time.
 */
data class AppRule(
    val pkg: String,
    val blockMode: String = BLOCK_OFF,
    val blockWindows: List<TimeWindow> = emptyList(),
    val dailyLimitMin: Int = 0,
    val maxOpens: Int = 0,
    val sessionMin: Int = 0,
    val delaySeconds: Int = 0,
    val delayAutoOpen: Boolean = true,
    val delayMessage: String = "",
    val limitWindows: List<TimeWindow> = emptyList(),
) {
    val hasLimits: Boolean get() = dailyLimitMin > 0 || maxOpens > 0 || sessionMin > 0 || delaySeconds > 0

    fun isBlockedAt(cal: Calendar): Boolean = when (blockMode) {
        BLOCK_ALWAYS -> true
        BLOCK_SCHEDULED -> blockWindows.any { it.contains(dow(cal), mod(cal)) }
        else -> false
    }

    fun limitsInForceAt(cal: Calendar): Boolean {
        if (!hasLimits) return false
        if (limitWindows.isEmpty()) return true
        return limitWindows.any { it.contains(dow(cal), mod(cal)) }
    }

    fun toJson(): JSONObject = JSONObject()
        .put("pkg", pkg)
        .put("blockMode", blockMode)
        .put("blockWindows", JSONArray(blockWindows.map { it.toJson() }))
        .put("dailyLimitMin", dailyLimitMin)
        .put("maxOpens", maxOpens)
        .put("sessionMin", sessionMin)
        .put("delaySeconds", delaySeconds)
        .put("delayAutoOpen", delayAutoOpen)
        .put("delayMessage", delayMessage)
        .put("limitWindows", JSONArray(limitWindows.map { it.toJson() }))

    companion object {
        const val BLOCK_OFF = "off"
        const val BLOCK_ALWAYS = "always"
        const val BLOCK_SCHEDULED = "scheduled"
        const val MAX_DELAY_SECONDS = 3600
        const val MAX_DELAY_MESSAGE = 300

        private fun dow(cal: Calendar) = cal.get(Calendar.DAY_OF_WEEK) - 1
        private fun mod(cal: Calendar) = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

        private fun windows(arr: JSONArray?): List<TimeWindow> {
            if (arr == null) return emptyList()
            return (0 until arr.length()).mapNotNull { arr.optJSONObject(it)?.let(TimeWindow::fromJson) }
        }

        fun fromJson(o: JSONObject): AppRule? {
            val pkg = o.optString("pkg", "")
            if (pkg.isEmpty()) return null
            val mode = o.optString("blockMode", BLOCK_OFF).let {
                if (it == BLOCK_ALWAYS || it == BLOCK_SCHEDULED) it else BLOCK_OFF
            }
            return AppRule(
                pkg = pkg,
                blockMode = mode,
                blockWindows = windows(o.optJSONArray("blockWindows")),
                dailyLimitMin = o.optInt("dailyLimitMin", 0).coerceAtLeast(0),
                maxOpens = o.optInt("maxOpens", 0).coerceAtLeast(0),
                sessionMin = o.optInt("sessionMin", 0).coerceAtLeast(0),
                delaySeconds = o.optInt("delaySeconds", 0).coerceIn(0, MAX_DELAY_SECONDS),
                delayAutoOpen = o.optBoolean("delayAutoOpen", true),
                delayMessage = o.optString("delayMessage", "").take(MAX_DELAY_MESSAGE),
                limitWindows = windows(o.optJSONArray("limitWindows")),
            )
        }

        fun listFromJson(json: String): List<AppRule> {
            val arr = JSONArray(json)
            return (0 until arr.length()).mapNotNull { arr.optJSONObject(it)?.let(::fromJson) }
        }

        fun listToJson(rules: Collection<AppRule>): String = JSONArray(rules.map { it.toJson() }).toString()
    }
}
