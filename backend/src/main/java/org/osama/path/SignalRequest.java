package org.osama.path;

import org.osama.path.scoring.SignalCombine;

import java.util.List;

/** A whole signal: how inputs combine, and at least one input. */
public record SignalRequest(SignalCombine combineMethod, List<SignalInputRequest> inputs) {
}
