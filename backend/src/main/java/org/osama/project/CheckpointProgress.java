package org.osama.project;

import java.time.LocalDate;
import java.util.Map;
import java.util.TreeMap;

/**
 * Pure progress of a checkpoint's metric.
 *
 * @param current   the measured value today (null for LATEST with nothing logged yet)
 * @param fraction  0 to 1; 1 once reached, even if a LATEST value later moves away again
 * @param reachedOn the first day the target was reached, or null
 */
public record CheckpointProgress(Double current, double fraction, LocalDate reachedOn) {

    public boolean reached() {
        return reachedOn != null;
    }

    /** Measures from {@code metric.countFrom()} through {@code today}; later and earlier days are ignored. */
    public static CheckpointProgress measure(CheckpointMetric metric, Map<LocalDate, Double> loggedValues, LocalDate today) {
        TreeMap<LocalDate, Double> days = new TreeMap<>();
        loggedValues.forEach((date, value) -> {
            if (!date.isBefore(metric.countFrom()) && !date.isAfter(today)) days.put(date, value);
        });
        return switch (metric.aggregation()) {
            case SUM, COUNT_DAYS -> accumulate(metric, days);
            case LATEST -> latest(metric, days);
        };
    }

    private static CheckpointProgress accumulate(CheckpointMetric metric, TreeMap<LocalDate, Double> days) {
        double total = metric.baseline();
        LocalDate reachedOn = total >= metric.targetValue() ? metric.countFrom() : null;
        for (Map.Entry<LocalDate, Double> day : days.entrySet()) {
            if (metric.aggregation() == CheckpointAggregation.SUM) total += day.getValue();
            else if (day.getValue() != 0) total += 1;
            if (reachedOn == null && total >= metric.targetValue()) reachedOn = day.getKey();
        }
        double fraction = reachedOn != null || metric.targetValue() <= 0 ? 1 : clamp(total / metric.targetValue());
        return new CheckpointProgress(total, fraction, reachedOn);
    }

    private static CheckpointProgress latest(CheckpointMetric metric, TreeMap<LocalDate, Double> days) {
        if (days.isEmpty()) return new CheckpointProgress(null, 0, null);
        LocalDate reachedOn = null;
        for (Map.Entry<LocalDate, Double> day : days.entrySet()) {
            boolean there = metric.falling() ? day.getValue() <= metric.targetValue() : day.getValue() >= metric.targetValue();
            if (there) {
                reachedOn = day.getKey();
                break;
            }
        }
        double current = days.lastEntry().getValue();
        if (reachedOn != null) return new CheckpointProgress(current, 1, reachedOn);
        double fraction;
        if (metric.falling()) {
            double start = days.firstEntry().getValue();
            fraction = start <= metric.targetValue() ? 1 : clamp((start - current) / (start - metric.targetValue()));
        } else {
            fraction = metric.targetValue() <= 0 ? 1 : clamp(current / metric.targetValue());
        }
        return new CheckpointProgress(current, fraction, null);
    }

    private static double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }
}
