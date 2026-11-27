package org.osama.project;

import java.time.LocalDate;

/**
 * What a checkpoint measures. {@code baseline} is progress made before logging started and is added
 * to SUM and COUNT_DAYS. {@code falling} applies to LATEST only: the target is reached when the value
 * falls to it, for less-is-better stats.
 */
public record CheckpointMetric(CheckpointAggregation aggregation, LocalDate countFrom, double baseline,
                               double targetValue, boolean falling) {
}
