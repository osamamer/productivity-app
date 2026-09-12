package org.osama.task.recurrence;

import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskSeriesUpdateRequest {
    private TaskRecurrenceFrequency recurrenceFrequency;
    private Integer importance;
    private LocalDate recurrenceEndDate;
    private Integer recurrenceInterval;
    private TaskRecurrenceUnit recurrenceUnit;
    private List<DayOfWeek> recurrenceDaysOfWeek;
    private LocalDateTime startDateTime;
    private String timeZone;
    private Boolean active;
}
