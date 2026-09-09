package org.osama.task.recurrence;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DayOfWeek;
import java.util.List;

public record TaskSeriesResponse(
        String seriesId,
        String name,
        String description,
        String tag,
        int importance,
        String mentalThreadId,
        LocalDateTime startDateTime,
        TaskRecurrenceFrequency recurrenceFrequency,
        LocalDate recurrenceEndDate,
        Integer recurrenceInterval,
        TaskRecurrenceUnit recurrenceUnit,
        List<DayOfWeek> recurrenceDaysOfWeek,
        String timeZone,
        Integer reminderMinutesBefore,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
