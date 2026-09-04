package org.osama.stat;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

public final class SystemStatCatalog {

    public static final String MEDITATED_SYSTEM_KEY = "meditated";
    public static final String MEDITATION_MINUTES_SYSTEM_KEY = "meditation_minutes";
    public static final String SLEEP_HOURS_SYSTEM_KEY = "sleep_hours";

    private static final Set<String> AUTOMATIC_SYSTEM_KEYS = Set.of(
            MEDITATED_SYSTEM_KEY, MEDITATION_MINUTES_SYSTEM_KEY
    );

    // These definitions are captured by combined check-ins rather than daily stat entries.
    public static final List<SystemStatDefinition> MENTAL_STATE_STATS = List.of(
            range("energy", "Energy", "How much physical and mental energy you have."),
            range("activation", "Activation", "How keyed up or activated your body feels."),
            range("stimulation_hunger", "Stimulation Hunger", "How strongly you want more stimulation."),
            range("clarity", "Clarity", "How clear and organized your mind feels."),
            range("valence", "Valence", "How pleasant or unpleasant your current state feels."),
            range("emotional_load", "Emotional Load", "How much emotional weight you are carrying.")
    );

    private static final Set<String> LEGACY_MENTAL_STATE_SYSTEM_KEYS = Set.of(
            "stimulation", "hunger", "arousal"
    );

    private static final Set<String> MENTAL_STATE_SYSTEM_KEYS = Stream.concat(
                    MENTAL_STATE_STATS.stream().map(SystemStatDefinition::systemKey),
                    LEGACY_MENTAL_STATE_SYSTEM_KEYS.stream())
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

    public static final List<SystemStatDefinition> MEDITATION_STATS = List.of(
            yesNo(MEDITATED_SYSTEM_KEY, "Meditated", "Whether you completed a meditation session that day."),
            number(MEDITATION_MINUTES_SYSTEM_KEY, "Meditation minutes", "Total meditation time completed that day, in minutes.")
    );

    public static final List<SystemStatDefinition> DAILY_LIFE_STATS = List.of(
            number(SLEEP_HOURS_SYSTEM_KEY, "Sleep", "How many hours you slept the previous night.",
                    StatMorality.GOOD, 7.0)
    );

    public static final List<SystemStatDefinition> SYSTEM_STATS = Stream
            .concat(MEDITATION_STATS.stream(), DAILY_LIFE_STATS.stream())
            .toList();

    private SystemStatCatalog() {
    }

    public static boolean isMentalStateSystemKey(String systemKey) {
        return systemKey != null && MENTAL_STATE_SYSTEM_KEYS.contains(systemKey);
    }

    public static boolean isAutomaticallyLoggedSystemKey(String systemKey) {
        return systemKey != null && AUTOMATIC_SYSTEM_KEYS.contains(systemKey);
    }

    private static SystemStatDefinition range(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.RANGE,
                1.0, 10.0, null, null);
    }

    private static SystemStatDefinition yesNo(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.BOOLEAN,
                null, null, null, null);
    }

    private static SystemStatDefinition number(String systemKey, String name, String description) {
        return number(systemKey, name, description, null, null);
    }

    private static SystemStatDefinition number(String systemKey, String name, String description,
                                               StatMorality morality, Double goodThreshold) {
        return new SystemStatDefinition(systemKey, name, description, StatType.NUMBER,
                null, null, morality, goodThreshold);
    }
}
