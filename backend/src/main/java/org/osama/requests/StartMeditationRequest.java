package org.osama.requests;

import lombok.Data;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

import static org.osama.constants.MeditationConstants.*;

@Data
public class StartMeditationRequest {
    @NotNull
    @Min(0)
    @Max(MAX_BELLS)
    private Integer numIntervalBells;

    @NotNull
    @Min(MIN_MOOD)
    @Max(MAX_MOOD)
    private Integer mood;

    @NotNull
    @Min(1)
    private Integer intendedLength;

}
