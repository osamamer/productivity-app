package org.osama.event;

import java.time.Instant;
import java.time.LocalDate;

public class CalendarEventRequest {
    private String title;
    private String description;
    private boolean allDay;
    private LocalDate startDate;
    private LocalDate endDate;
    private Instant startTime;
    private Instant endTime;
    private String timeZone;
    private Integer reminderMinutesBefore;
    private boolean reminderMinutesBeforePresent;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isAllDay() { return allDay; }
    public void setAllDay(boolean allDay) { this.allDay = allDay; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }
    public Integer getReminderMinutesBefore() { return reminderMinutesBefore; }
    public void setReminderMinutesBefore(Integer reminderMinutesBefore) {
        this.reminderMinutesBefore = reminderMinutesBefore;
        this.reminderMinutesBeforePresent = true;
    }
    public boolean isReminderMinutesBeforePresent() { return reminderMinutesBeforePresent; }
}
