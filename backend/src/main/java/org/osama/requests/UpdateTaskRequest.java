package org.osama.requests;

import com.fasterxml.jackson.annotation.JsonSetter;
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

    private String projectId;
    private boolean projectIdPresent;

    public void setReminderMinutesBefore(Integer reminderMinutesBefore) {
        this.reminderMinutesBefore = reminderMinutesBefore;
        this.reminderMinutesBeforePresent = true;
    }

    public boolean isReminderMinutesBeforePresent() {
        return reminderMinutesBeforePresent;
    }

    @JsonSetter("projectId")
    public void setProjectId(String projectId) {
        this.projectId = projectId;
        this.projectIdPresent = true;
    }
}
