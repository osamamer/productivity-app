package org.osama.path.scoring;

/**
 * What scoring needs from the stat behind an input.
 *
 * @param goodThreshold      the stat's good threshold, or null when it has none
 * @param thresholdIsMinimum true when values at or above the threshold are good, false when at or below;
 *                           null for a neutral stat, whose threshold is ignored
 */
public record StatFacts(boolean includeUnloggedDaysAsZero, Double goodThreshold, Boolean thresholdIsMinimum) {
    public static final StatFacts PLAIN = new StatFacts(false, null, null);

    /** A logged value that counts for TIMES: it meets the good threshold, or without one, is non-zero. */
    boolean qualifies(double value) {
        if (goodThreshold == null || thresholdIsMinimum == null) return value != 0;
        return thresholdIsMinimum ? value >= goodThreshold : value <= goodThreshold;
    }
}
