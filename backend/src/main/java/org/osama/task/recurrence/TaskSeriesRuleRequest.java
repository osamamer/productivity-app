package org.osama.task.recurrence;

import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@Data
public class TaskSeriesRuleRequest {
    private TaskRecurrenceFrequency recurrenceFrequency;
    private LocalDate recurrenceEndDate;
    private Integer recurrenceInterval;
    private TaskRecurrenceUnit recurrenceUnit;
    private List<DayOfWeek> recurrenceDaysOfWeek;
    private String timeZone;
}
