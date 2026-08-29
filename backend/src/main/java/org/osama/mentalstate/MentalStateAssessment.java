package org.osama.mentalstate;

import java.util.List;

public record MentalStateAssessment(
        String state,
        List<String> suggestedActions
) {
}
