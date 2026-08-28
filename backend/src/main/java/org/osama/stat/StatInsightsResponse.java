package org.osama.stat;

import java.time.LocalDate;
import java.util.List;

public record StatInsightsResponse(
        String statDefinitionId,
        String statName,
        LocalDate from,
        LocalDate to,
        int recordedDays,
        List<StatCorrelationResponse> correlations
) {
}
