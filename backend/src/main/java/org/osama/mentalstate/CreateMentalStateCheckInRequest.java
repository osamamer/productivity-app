package org.osama.mentalstate;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;

public record CreateMentalStateCheckInRequest(
        @Min(1) @Max(10) int energy,
        @Min(1) @Max(10) int activation,
        @Min(1) @Max(10) int stimulationHunger,
        @Min(1) @Max(10) int clarity,
        @Min(1) @Max(10) int valence,
        @Min(1) @Max(10) int emotionalLoad
) {
}
