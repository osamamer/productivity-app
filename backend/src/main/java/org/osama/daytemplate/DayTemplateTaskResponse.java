package org.osama.daytemplate;

import java.time.LocalTime;

public record DayTemplateTaskResponse(
        String id,
        int displayOrder,
        String name,
        String description,
        LocalTime scheduledTime,
        String tag,
        int importance
) {
}
