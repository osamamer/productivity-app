package org.osama.daytemplate;

import org.osama.event.CalendarEventResponse;
import org.osama.task.Task;

import java.time.LocalDate;
import java.util.List;

public record DayTemplateApplicationResponse(
        String templateId,
        String templateName,
        LocalDate date,
        List<CalendarEventResponse> events,
        List<Task> tasks
) {
}
