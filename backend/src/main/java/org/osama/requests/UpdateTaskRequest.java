package org.osama.requests;

import lombok.Data;

@Data
public class UpdateTaskRequest {
    private String name;
    private String description;
    private Boolean completed;
    private String tag;
    private Integer importance;

    private String scheduledPerformDateTime;
    private String timeZone;
    private Integer reminderMinutesBefore;
    private boolean reminderMinutesBeforePresent;

    public void setReminderMinutesBefore(Integer reminderMinutesBefore) {
        this.reminderMinutesBefore = reminderMinutesBefore;
        this.reminderMinutesBeforePresent = true;
    }

    public boolean isReminderMinutesBeforePresent() {
        return reminderMinutesBeforePresent;
    }
}
