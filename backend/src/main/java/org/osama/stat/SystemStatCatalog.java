package org.osama.stat;

import java.util.List;

public final class SystemStatCatalog {

    public static final List<SystemStatDefinition> MENTAL_STATE_STATS = List.of(
            range("stimulation", "Stimulation", "How mentally or sensorially stimulated you feel."),
            range("hunger", "Hunger", "How physically hungry you feel."),
            range("arousal", "Arousal", "How activated or physiologically keyed up you feel."),
            range("valence", "Valence", "How pleasant or unpleasant your current state feels.")
    );

    private SystemStatCatalog() {
    }

    private static SystemStatDefinition range(String systemKey, String name, String description) {
        return new SystemStatDefinition(systemKey, name, description, StatType.RANGE, 1.0, 10.0);
    }
}
