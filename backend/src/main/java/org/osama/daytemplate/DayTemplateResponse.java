package org.osama.daytemplate;

import java.time.Instant;
import java.util.List;

public record DayTemplateResponse(
        String id,
        String name,
        List<DayTemplateEventResponse> events,
        List<DayTemplateTaskResponse> tasks,
        Instant createdAt,
        Instant updatedAt
) {
}
