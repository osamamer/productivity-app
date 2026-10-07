package org.osama.calendar;

public record CalendarResponse(
        String id,
        String name,
        String color,
        int displayOrder,
        boolean defaultCalendar,
        boolean visible
) {
}
