package org.osama.stat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record StatBootstrapResponse(
        LocalDate from,
        LocalDate to,
        List<StatDefinition> definitions,
        Map<String, List<StatEntry>> entries,
        Map<String, StatSummaryResponse> summaries
) {
}
