package org.osama.calendar;

public record UpdateCalendarRequest(String name, String color, Integer displayOrder, Boolean visible) {
    public boolean isEmpty() {
        return name == null && color == null && displayOrder == null && visible == null;
    }
}
