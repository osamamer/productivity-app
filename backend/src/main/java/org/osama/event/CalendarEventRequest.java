package org.osama.event;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class CalendarEventRequest {
    private String title;
    private String calendarId;
    private String description;
    private boolean allDay;
    private LocalDate startDate;
    private LocalDate endDate;
    private Instant startTime;
    private Instant endTime;
    private String timeZone;
    private CalendarEventStatus status;
    private RecurrenceFrequency recurrenceFrequency;
    private LocalDate recurrenceEndDate;
    private Integer recurrenceInterval;
    private RecurrenceUnit recurrenceUnit;
    private List<DayOfWeek> recurrenceDaysOfWeek;
    private Integer reminderMinutesBefore;
    private boolean reminderMinutesBeforePresent;
    private String activityId;
    // Older clients do not send activityId; an update from them must not clear it.
    private boolean activityIdPresent;
    private String taskId;
    private boolean taskIdPresent;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCalendarId() { return calendarId; }
    public void setCalendarId(String calendarId) { this.calendarId = calendarId; }
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
    public CalendarEventStatus getStatus() { return status; }
    public void setStatus(CalendarEventStatus status) { this.status = status; }
    public RecurrenceFrequency getRecurrenceFrequency() { return recurrenceFrequency; }
    public void setRecurrenceFrequency(RecurrenceFrequency recurrenceFrequency) {
        this.recurrenceFrequency = recurrenceFrequency;
    }
    public LocalDate getRecurrenceEndDate() { return recurrenceEndDate; }
    public void setRecurrenceEndDate(LocalDate recurrenceEndDate) { this.recurrenceEndDate = recurrenceEndDate; }
    public Integer getRecurrenceInterval() { return recurrenceInterval; }
    public void setRecurrenceInterval(Integer recurrenceInterval) { this.recurrenceInterval = recurrenceInterval; }
    public RecurrenceUnit getRecurrenceUnit() { return recurrenceUnit; }
    public void setRecurrenceUnit(RecurrenceUnit recurrenceUnit) { this.recurrenceUnit = recurrenceUnit; }
    public List<DayOfWeek> getRecurrenceDaysOfWeek() { return recurrenceDaysOfWeek; }
    public void setRecurrenceDaysOfWeek(List<DayOfWeek> recurrenceDaysOfWeek) {
        this.recurrenceDaysOfWeek = recurrenceDaysOfWeek;
    }
    public Integer getReminderMinutesBefore() { return reminderMinutesBefore; }
    public void setReminderMinutesBefore(Integer reminderMinutesBefore) {
        this.reminderMinutesBefore = reminderMinutesBefore;
        this.reminderMinutesBeforePresent = true;
    }
    public boolean isReminderMinutesBeforePresent() { return reminderMinutesBeforePresent; }
    public String getActivityId() { return activityId; }
    public void setActivityId(String activityId) {
        this.activityId = activityId;
        this.activityIdPresent = true;
    }
    public boolean isActivityIdPresent() { return activityIdPresent; }
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) {
        this.taskId = taskId;
        this.taskIdPresent = true;
    }
    public boolean isTaskIdPresent() { return taskIdPresent; }
}
