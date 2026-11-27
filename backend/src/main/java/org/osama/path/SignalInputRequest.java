package org.osama.path;

import org.osama.path.scoring.InputDirection;
import org.osama.path.scoring.InputScoring;

/**
 * One input of a signal. {@code valueSource} defaults to VALUE, {@code direction} to the stat's morality,
 * {@code weight} to 1. The period follows from {@code scoring}.
 */
public record SignalInputRequest(String statDefinitionId, String valueSource, InputDirection direction,
                                 InputScoring scoring, Double target, Double weight) {
}
