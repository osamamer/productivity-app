package org.osama.event;

import java.time.Instant;
import java.time.LocalDate;

public class CalendarEventOccurrenceRequest {
    private String occurrenceKey;
    private CalendarEventStatus status;
    private LocalDate startDate;
    private LocalDate endDate;
    private Instant startTime;
    private Instant endTime;

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

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }
}
