package org.osama.project;

/**
 * How a checkpoint's stat is measured: SUM totals values since its start date, COUNT_DAYS counts
 * logged days, LATEST takes the most recent value (a savings balance, a weight).
 */
public enum CheckpointAggregation {
    SUM,
    COUNT_DAYS,
    LATEST
}
