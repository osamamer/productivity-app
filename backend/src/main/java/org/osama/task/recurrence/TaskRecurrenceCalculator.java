package org.osama.task.recurrence;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

public final class TaskRecurrenceCalculator {
    private TaskRecurrenceCalculator() {
    }

    public static List<LocalDateTime> occurrencesBetween(
            TaskSeries series,
            LocalDateTime fromInclusive,
            LocalDateTime throughInclusive
    ) {
        List<LocalDateTime> occurrences = new ArrayList<>();
        LocalDateTime occurrence = series.getStartDateTime();
        int guard = 0;
        while (!occurrence.isAfter(throughInclusive) && guard++ < 20_000) {
            if (!occurrence.isBefore(fromInclusive) && isAllowedByEndDate(series, occurrence)) {
                occurrences.add(occurrence);
            }
            if (!isAllowedByEndDate(series, occurrence)) {
                break;
            }
            occurrence = nextOccurrence(series, occurrence);
        }
        return occurrences;
    }

    public static LocalDateTime nextOccurrence(TaskSeries series, LocalDateTime current) {
        int interval = series.getRecurrenceFrequency() == TaskRecurrenceFrequency.CUSTOM
                ? requireInterval(series)
                : 1;
        TaskRecurrenceUnit unit = unitFor(series);
        ZonedDateTime currentZoned = current.atZone(zoneFor(series));

        return switch (unit) {
            case DAYS -> currentZoned.plusDays(interval).toLocalDateTime();
            case WEEKS -> currentZoned.plusWeeks(interval).toLocalDateTime();
            case MONTHS -> nextMonthOccurrence(series, currentZoned, interval);
        };
    }

    private static LocalDateTime nextMonthOccurrence(TaskSeries series, ZonedDateTime current, int interval) {
        YearMonth nextMonth = YearMonth.from(current).plusMonths(interval);
        int anchorDay = series.getStartDateTime().getDayOfMonth();
        LocalDate nextDate = nextMonth.atDay(Math.min(anchorDay, nextMonth.lengthOfMonth()));
        return ZonedDateTime.of(nextDate, current.toLocalTime(), current.getZone()).toLocalDateTime();
    }

    private static TaskRecurrenceUnit unitFor(TaskSeries series) {
        if (series.getRecurrenceFrequency() == TaskRecurrenceFrequency.DAILY) return TaskRecurrenceUnit.DAYS;
        if (series.getRecurrenceFrequency() == TaskRecurrenceFrequency.WEEKLY) return TaskRecurrenceUnit.WEEKS;
        if (series.getRecurrenceFrequency() == TaskRecurrenceFrequency.MONTHLY) return TaskRecurrenceUnit.MONTHS;
        if (series.getRecurrenceUnit() == null) {
            throw new IllegalArgumentException("A custom recurrence needs a unit.");
        }
        return series.getRecurrenceUnit();
    }

    private static int requireInterval(TaskSeries series) {
        Integer interval = series.getRecurrenceInterval();
        if (interval == null || interval < 1 || interval > 999) {
            throw new IllegalArgumentException("A custom recurrence needs an interval between 1 and 999.");
        }
        return interval;
    }

    private static boolean isAllowedByEndDate(TaskSeries series, LocalDateTime occurrence) {
        return series.getRecurrenceEndDate() == null
                || !occurrence.toLocalDate().isAfter(series.getRecurrenceEndDate());
    }

    private static ZoneId zoneFor(TaskSeries series) {
        return ZoneId.of(series.getTimeZone());
    }
}
