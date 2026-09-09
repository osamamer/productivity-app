package org.osama.task.recurrence;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TaskSeriesUpdateRequest {
    private TaskRecurrenceFrequency recurrenceFrequency;
    private LocalDate recurrenceEndDate;
    private Integer recurrenceInterval;
    private TaskRecurrenceUnit recurrenceUnit;
    private String timeZone;
    private Boolean active;
}
