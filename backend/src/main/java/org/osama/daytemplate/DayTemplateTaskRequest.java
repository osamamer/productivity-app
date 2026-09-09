package org.osama.daytemplate;

import java.time.LocalTime;

public record DayTemplateTaskRequest(
        String name,
        String description,
        LocalTime scheduledTime,
        String tag,
        int importance
) {
}
