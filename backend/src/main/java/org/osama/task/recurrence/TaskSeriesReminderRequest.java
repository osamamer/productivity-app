package org.osama.task.recurrence;

import lombok.Data;

/** {@code reminderMinutesBefore} null turns the reminder off for the series. */
@Data
public class TaskSeriesReminderRequest {
    private Integer reminderMinutesBefore;
}
