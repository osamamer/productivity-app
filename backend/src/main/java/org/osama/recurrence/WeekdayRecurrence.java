package org.osama.recurrence;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;

/**
 * "Every N weeks on these days", as iCalendar reads {@code FREQ=WEEKLY;INTERVAL=N;BYDAY=...;WKST=SU}: weeks
 * start on Sunday, the anchor's week is week 0, and only every Nth week repeats. Days before the anchor in its own week
 * are not occurrences. The web and mobile calendars expand events with the same rule.
 */
public final class WeekdayRecurrence {
    private WeekdayRecurrence() {
    }

    public static boolean isOccurrence(LocalDate anchor, LocalDate date, Collection<DayOfWeek> days, int interval) {
        if (date.isBefore(anchor) || !days.contains(date.getDayOfWeek())) return false;
        long weeks = ChronoUnit.WEEKS.between(weekStart(anchor), weekStart(date));
        return weeks % Math.max(1, interval) == 0;
    }

    /** The first occurrence after {@code current}. */
    public static LocalDate next(LocalDate anchor, LocalDate current, Collection<DayOfWeek> days, int interval) {
        if (days.isEmpty()) throw new IllegalArgumentException("A weekday recurrence needs at least one day.");
        int span = 7 * (Math.max(1, interval) + 1);
        for (int offset = 1; offset <= span; offset++) {
            LocalDate candidate = current.plusDays(offset);
            if (isOccurrence(anchor, candidate, days, interval)) return candidate;
        }
        throw new IllegalStateException("No weekday occurrence found after " + current);
    }

    private static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    }
}
