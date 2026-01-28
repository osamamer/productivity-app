package org.osama.requests;

import lombok.Data;
import org.osama.session.meditation.MeditationSessionService;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

import static org.osama.constants.MeditationConstants.*;

@Data
public class StartMeditationRequest {
    @NotNull
    @Min(0)
    @Max(MAX_BELLS)
    private int numIntervalBells;

    @Min(MIN_MOOD)
    @Max(MAX_MOOD)
    private int mood;

}
