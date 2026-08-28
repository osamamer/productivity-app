package org.osama.stat;

/**
 * The relationship between the selected stat (the driver) and another stat.
 * A correlation describes an association in the user's own entries, not causation.
 */
public record StatCorrelationResponse(
        String statDefinitionId,
        String statName,
        StatType statType,
        int overlapDays,
        Double correlation,
        String strength,
        String direction,
        boolean meaningful,
        Double otherAverageWhenDriverHigher,
        Double otherAverageWhenDriverLower,
        String insight
) {
}
