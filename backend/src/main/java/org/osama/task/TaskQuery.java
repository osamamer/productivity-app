package org.osama.task;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskQuery {
    private LocalDate date;
    private DatePeriod period;
    private Boolean completed;
    private String parentId;
    private Integer minImportance;
    private String tag;

    public enum DatePeriod {
        TODAY, PAST, FUTURE
    }

    // Helper methods
    public boolean isMainTasksOnly() {
        return parentId == null;
    }

    public LocalDate getResolvedDate() {
        if (date != null) return date;
        if (period == DatePeriod.TODAY) return LocalDate.now();
        return null;
    }
}
