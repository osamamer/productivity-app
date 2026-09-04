package org.osama.stat;

public record SystemStatDefinition(
        String systemKey,
        String name,
        String description,
        StatType type,
        Double minValue,
        Double maxValue,
        StatMorality morality,
        Double goodThreshold
) {
}
