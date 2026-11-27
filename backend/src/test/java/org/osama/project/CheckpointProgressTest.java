package org.osama.project;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CheckpointProgressTest {
    private static final LocalDate START = LocalDate.of(2026, 11, 1);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 26);
    private static final double DELTA = 1e-9;

    private static LocalDate day(int dayOfMonth) {
        return LocalDate.of(2026, 11, dayOfMonth);
    }

    @Test
    void sumAddsTheBaselineToEverythingLoggedSinceTheStart() {
        // 70.1k words already written before logging started.
        CheckpointMetric actTwo = new CheckpointMetric(CheckpointAggregation.SUM, START, 70_100, 80_000, false);

        CheckpointProgress progress = CheckpointProgress.measure(actTwo, Map.of(day(3), 2_000.0, day(10), 3_000.0), TODAY);

        assertEquals(75_100, progress.current(), DELTA);
        assertEquals(75_100 / 80_000.0, progress.fraction(), DELTA);
        assertNull(progress.reachedOn());
    }

    @Test
    void reachedOnIsTheDayTheRunningTotalGotThere() {
        CheckpointMetric metric = new CheckpointMetric(CheckpointAggregation.SUM, START, 0, 5, false);

        CheckpointProgress progress = CheckpointProgress.measure(metric, Map.of(day(2), 3.0, day(5), 3.0, day(9), 1.0), TODAY);

        assertEquals(day(5), progress.reachedOn());
        assertEquals(1, progress.fraction(), DELTA);
    }

    @Test
    void daysBeforeTheStartAndAfterTodayDoNotCount() {
        CheckpointMetric metric = new CheckpointMetric(CheckpointAggregation.SUM, day(10), 0, 100, false);

        CheckpointProgress progress = CheckpointProgress.measure(metric,
                Map.of(day(9), 50.0, day(12), 10.0, day(27), 50.0), TODAY);

        assertEquals(10, progress.current(), DELTA);
    }

    @Test
    void countDaysCountsLoggedNonZeroDays() {
        CheckpointMetric metric = new CheckpointMetric(CheckpointAggregation.COUNT_DAYS, START, 2, 10, false);

        CheckpointProgress progress = CheckpointProgress.measure(metric, Map.of(day(2), 1.0, day(3), 0.0, day(4), 1.0), TODAY);

        assertEquals(4, progress.current(), DELTA);
        assertEquals(0.4, progress.fraction(), DELTA);
    }

    @Test
    void latestUsesTheMostRecentValueAndStaysReachedOnceItGotThere() {
        CheckpointMetric savings = new CheckpointMetric(CheckpointAggregation.LATEST, START, 0, 9_000, false);

        CheckpointProgress progress = CheckpointProgress.measure(savings, Map.of(day(5), 9_200.0, day(20), 8_700.0), TODAY);

        assertEquals(8_700, progress.current(), DELTA);
        assertEquals(day(5), progress.reachedOn());
        assertEquals(1, progress.fraction(), DELTA);
    }

    @Test
    void latestWithNothingLoggedHasNoValue() {
        CheckpointProgress progress = CheckpointProgress.measure(
                new CheckpointMetric(CheckpointAggregation.LATEST, START, 0, 10, false), Map.of(), TODAY);

        assertNull(progress.current());
        assertEquals(0, progress.fraction(), DELTA);
    }

    @Test
    void aFallingTargetIsReachedWhenTheValueFallsToItAndMeasuresFromTheFirstValue() {
        CheckpointMetric weight = new CheckpointMetric(CheckpointAggregation.LATEST, START, 0, 80, true);

        CheckpointProgress halfway = CheckpointProgress.measure(weight, Map.of(day(1), 90.0, day(20), 85.0), TODAY);
        CheckpointProgress there = CheckpointProgress.measure(weight, Map.of(day(1), 90.0, day(20), 80.0), TODAY);

        assertEquals(0.5, halfway.fraction(), DELTA);
        assertEquals(day(20), there.reachedOn());
    }
}
