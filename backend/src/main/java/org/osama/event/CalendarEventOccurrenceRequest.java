package org.osama.event;

public class CalendarEventOccurrenceRequest {
    private String occurrenceKey;
    private CalendarEventStatus status;

    public String getOccurrenceKey() {
        return occurrenceKey;
    }

    public void setOccurrenceKey(String occurrenceKey) {
        this.occurrenceKey = occurrenceKey;
    }

    public CalendarEventStatus getStatus() {
        return status;
    }

    public void setStatus(CalendarEventStatus status) {
        this.status = status;
    }
}
