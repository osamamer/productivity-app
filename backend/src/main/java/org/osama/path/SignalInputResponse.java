package org.osama.path;

import org.osama.path.scoring.InputDirection;
import org.osama.path.scoring.InputPeriod;
import org.osama.path.scoring.InputScoring;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatType;

/**
 * One input as the web app shows it. {@code statName}, {@code unit} and {@code valueType} are null
 * when the stat has since been deleted; such an input scores nothing.
 */
public record SignalInputResponse(String id, String statDefinitionId, String statName, String unit,
                                  String valueSource, StatType valueType, InputDirection direction,
                                  InputPeriod period, InputScoring scoring, double target, double weight) {
    static SignalInputResponse from(PathSignalInput input, StatDefinition definition) {
        return new SignalInputResponse(input.getId(), input.getStatDefinitionId(),
                definition == null ? null : definition.getName(),
                definition == null ? null : definition.getUnit(),
                input.getValueSource(),
                definition == null ? null : SignalFactory.valueType(definition, input.getValueSource()),
                input.getDirection(), input.getPeriod(), input.getScoring(), input.getTarget(), input.getWeight());
    }
}
