package org.osama.mentalstate;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

public record CreateMentalStateCheckInRequest(
        @NotNull MentalStateGoal goal,
        @Min(1) @Max(10) int energy,
        @Min(1) @Max(10) int activation,
        @Min(1) @Max(10) int stimulationHunger,
        @Min(1) @Max(10) int clarity,
        @Min(1) @Max(10) int valence,
        @Min(1) @Max(10) int emotionalLoad
) {
    public CreateMentalStateCheckInRequest(int energy, int activation, int stimulationHunger,
                                           int clarity, int valence, int emotionalLoad) {
        this(MentalStateGoal.LABOR, energy, activation, stimulationHunger, clarity, valence, emotionalLoad);
    }
}
