package org.osama.path.scoring;

/**
 * One input's result for one week.
 *
 * @param score    0 to {@link SignalScoring#CAP}; 1 is a fully kept week
 * @param achieved what the user did in the week's terms: qualifying days for TIMES, the sum for TOTAL,
 *                 days met for DAYS_MET, the mean daily value for AVERAGE
 */
public record InputWeekScore(double score, double achieved) {
    static final InputWeekScore NOTHING = new InputWeekScore(0, 0);
}
