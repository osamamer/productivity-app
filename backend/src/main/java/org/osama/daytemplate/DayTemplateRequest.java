package org.osama.daytemplate;

import java.util.List;

public record DayTemplateRequest(
        String name,
        List<DayTemplateEventRequest> events,
        List<DayTemplateTaskRequest> tasks
) {
}
