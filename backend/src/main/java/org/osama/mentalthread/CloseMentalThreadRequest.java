package org.osama.mentalthread;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

public record CloseMentalThreadRequest(
        @NotNull ClosureType closureType,
        @Size(max = 5000) String resolutionSummary
) {
}
