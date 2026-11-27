package org.osama.path;

import java.time.LocalDate;
import java.util.List;

/**
 * A path's strength for one week, with each input's result in signal order.
 *
 * @param elapsedDays 7 for a past week; for the current week, the days that have passed including today
 */
public record WeekStrength(LocalDate weekStart, int elapsedDays, double strength, List<InputResult> inputs) {
    public record InputResult(double score, double achieved) {
    }
}
