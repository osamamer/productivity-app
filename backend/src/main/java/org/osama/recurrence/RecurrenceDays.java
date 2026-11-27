package org.osama.recurrence;

import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.stream.Collectors;

/** Stores weekdays as a comma-separated column, Sunday first. */
public final class RecurrenceDays {
    private static final Comparator<DayOfWeek> SUNDAY_FIRST =
            Comparator.comparingInt(day -> day.getValue() % 7);

    private RecurrenceDays() {
    }

    public static String encode(List<DayOfWeek> days) {
        if (days == null || days.isEmpty()) return null;
        return EnumSet.copyOf(days).stream().sorted(SUNDAY_FIRST)
                .map(Enum::name).collect(Collectors.joining(","));
    }

    public static List<DayOfWeek> decode(String encoded) {
        if (encoded == null || encoded.isBlank()) return List.of();
        return Arrays.stream(encoded.split(","))
                .map(String::trim)
                .filter(day -> !day.isEmpty())
                .map(DayOfWeek::valueOf)
                .sorted(SUNDAY_FIRST)
                .toList();
    }
}
