package org.osama.task.recurrence;

import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Comparator;
import java.util.stream.Collectors;

final class TaskRecurrenceDays {
    private static final Comparator<DayOfWeek> SUNDAY_FIRST =
            Comparator.comparingInt(day -> day.getValue() % 7);

    private TaskRecurrenceDays() {
    }

    static String encode(List<DayOfWeek> days) {
        if (days == null || days.isEmpty()) return null;
        EnumSet<DayOfWeek> uniqueDays = EnumSet.copyOf(days);
        return uniqueDays.stream().sorted(SUNDAY_FIRST)
                .map(Enum::name).collect(Collectors.joining(","));
    }

    static List<DayOfWeek> decode(String encoded) {
        if (encoded == null || encoded.isBlank()) return List.of();
        return Arrays.stream(encoded.split(","))
                .map(String::trim)
                .filter(day -> !day.isEmpty())
                .map(DayOfWeek::valueOf)
                .sorted(SUNDAY_FIRST)
                .toList();
    }

    static boolean contains(String encoded, DayOfWeek day) {
        return decode(encoded).contains(Objects.requireNonNull(day));
    }
}
