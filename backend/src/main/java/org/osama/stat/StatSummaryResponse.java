package org.osama.stat;

/**
 * Summary statistics for a single stat definition, computed server-side.
 * Fields that don't apply to the definition's type are null.
 */
public record StatSummaryResponse(
        int checkInStreak,         // consecutive days with any entry, ending at the selected period's end
        Integer periodYesCount,    // entries with value=1 in the selected period (BOOLEAN only)
        Integer booleanStreak,     // consecutive days with value=1, ending at the selected period's end
        Integer longestBooleanStreak, // longest consecutive run of value=1 in the selected period (BOOLEAN only)
        Double periodAverage,      // average value in the selected period (NUMBER / RANGE only)
        Double periodTotal,         // sum of values in the selected period (NUMBER / RANGE only)
        Double periodHighest        // highest single-day value in the selected period (NUMBER / RANGE only)
) {}
