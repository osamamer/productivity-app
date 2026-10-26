package org.osama.stat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

public record StatWeeklyTaskScheduleResponse(
        LocalDate weekStartDate,
        List<DayOfWeek> daysOfWeek,
        String taskName,
        String timeOfDay,
        int importance
) {
    public StatWeeklyTaskScheduleResponse {
        daysOfWeek = daysOfWeek == null ? List.of() : List.copyOf(daysOfWeek);
    }
}
