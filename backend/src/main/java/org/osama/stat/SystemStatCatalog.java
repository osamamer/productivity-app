package org.osama.stat;

import java.util.List;
import java.util.stream.Stream;

public final class SystemStatCatalog {

    public static final String MEDITATED_SYSTEM_KEY = "meditated";
    public static final String MEDITATION_MINUTES_SYSTEM_KEY = "meditation_minutes";

    public static final List<SystemStatDefinition> MENTAL_STATE_STATS = List.of(
            range("stimulation", "Stimulation", "How mentally or sensorially stimulated you feel."),
            range("hunger", "Hunger", "How physically hungry you feel."),
            range("arousal", "Arousal", "How activated or physiologically keyed up you feel."),
            range("valence", "Valence", "How pleasant or unpleasant your current state feels.")
    );

    public static final List<SystemStatDefinition> MEDITATION_STATS = List.of(
            yesNo(MEDITATED_SYSTEM_KEY, "Meditated", "Whether you completed a meditation session that day."),
            number(MEDITATION_MINUTES_SYSTEM_KEY, "Meditation minutes", "Total meditation time completed that day, in minutes.")
    );

    public static final List<SystemStatDefinition> SYSTEM_STATS = Stream
            .concat(MENTAL_STATE_STATS.stream(), MEDITATION_STATS.stream())
            .toList();

    private SystemStatCatalog() {
    }

    private static SystemStatDefinition range(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.RANGE, 1.0, 10.0);
    }

    private static SystemStatDefinition yesNo(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.BOOLEAN, null, null);
    }

    private static SystemStatDefinition number(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.NUMBER, null, null);
    }
}
