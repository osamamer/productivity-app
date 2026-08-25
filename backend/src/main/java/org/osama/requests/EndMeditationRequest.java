package org.osama.requests;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;

import static org.osama.constants.MeditationConstants.MAX_MOOD;
import static org.osama.constants.MeditationConstants.MIN_MOOD;

@Data
public class EndMeditationRequest {
    @Min(MIN_MOOD)
    @Max(MAX_MOOD)
    private Integer moodAfter;
}
