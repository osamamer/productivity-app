package org.osama.stat;

import java.time.LocalDate;

public record StatFocusTimeEntryResponse(
        LocalDate date,
        long totalFocusSeconds
) {
}
