package org.osama.path.scoring;

/** What "doing well" means for one input: a target per day or week, scored one way. */
public record InputRule(InputScoring scoring, InputDirection direction, double target, double weight) {
}
