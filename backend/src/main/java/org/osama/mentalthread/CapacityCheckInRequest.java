package org.osama.mentalthread;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;

public record CapacityCheckInRequest(
        @Min(1) @Max(10) int capacity
) {
}
