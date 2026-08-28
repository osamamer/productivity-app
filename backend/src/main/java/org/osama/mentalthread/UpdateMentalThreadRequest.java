package org.osama.mentalthread;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateMentalThreadRequest(
        @NotNull @Size(min = 1, max = 160) String title,
        @Size(max = 5000) String description,
        @NotNull AttentionState attentionState,
        @Size(max = 5000) String desiredResolution,
        LocalDate targetCloseDate,
        LocalDate hardDeadlineDate,
        LocalDate nextReviewDate,
        @Min(1) @Max(10) int currentMentalLoad,
        @Size(max = 500) String loadReason
) {
}
