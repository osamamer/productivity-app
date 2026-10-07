package org.osama.daytemplate;

import java.time.LocalTime;

public record DayTemplateTaskRequest(
        String name,
        String description,
        LocalTime scheduledTime,
        String tag,
        int importance,
        String calendarId
) {
    public DayTemplateTaskRequest(String name, String description, LocalTime scheduledTime, String tag, int importance) {
        this(name, description, scheduledTime, tag, importance, null);
    }
}
