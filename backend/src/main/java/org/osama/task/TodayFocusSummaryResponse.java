package org.osama.task;

import java.time.LocalDate;

public record TodayFocusSummaryResponse(
        LocalDate date,
        long totalFocusSeconds
) {
}
