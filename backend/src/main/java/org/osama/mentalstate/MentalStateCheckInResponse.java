package org.osama.mentalstate;

import java.time.Instant;
import java.util.List;

public record MentalStateCheckInResponse(
        String id,
        Instant recordedAt,
        MentalStateGoal goal,
        String state,
        List<String> suggestedActions
) {
    static MentalStateCheckInResponse from(MentalStateCheckIn checkIn, MentalStateAssessment assessment) {
        return new MentalStateCheckInResponse(
                checkIn.getId(),
                checkIn.getRecordedAt(),
                checkIn.getGoal(),
                assessment.state(),
                assessment.suggestedActions()
        );
    }
}
