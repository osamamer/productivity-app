package org.osama.stat;

/**
 * Summary statistics for a single stat definition, computed server-side.
 * Fields that don't apply to the definition's type are null.
 */
public record StatSummaryResponse(
        int checkInStreak,         // consecutive days with any entry, ending today (all types)
        Integer monthlyCheckIns,   // total entries this calendar month (BOOLEAN only)
        Integer booleanStreak,     // consecutive days with value=1, ending today (BOOLEAN only)
        Double monthlyAverage      // average value this calendar month (NUMBER / RANGE only)
) {}
