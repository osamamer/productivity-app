package org.osama.project;

import org.osama.stat.StatType;

import java.time.LocalDate;

/** A checkpoint with its measured progress. Stat fields are null once the stat has been deleted. */
public record CheckpointResponse(String id, String projectId, String name, LocalDate targetDate, int displayOrder,
                                 Metric metric, Double current, double progress, LocalDate reachedOn,
                                 long taskCount, long completedTaskCount) {
    public record Metric(String statDefinitionId, String statName, String unit, String valueSource, StatType valueType,
                         CheckpointAggregation aggregation, LocalDate countFrom, double baseline, double targetValue,
                         boolean falling) {
    }
}
