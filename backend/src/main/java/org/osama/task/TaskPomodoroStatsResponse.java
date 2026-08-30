package org.osama.task;

import java.time.LocalDate;

public record TaskPomodoroStatsResponse(
        String taskId,
        long totalFocusSeconds,
        int totalFocusSessions,
        int totalDaysWorked,
        int currentStreakDays,
        int longestStreakDays,
        LocalDate lastWorkedOnDate
) {
}
