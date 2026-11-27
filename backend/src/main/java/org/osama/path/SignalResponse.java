package org.osama.path;

import org.osama.path.scoring.SignalCombine;

import java.util.List;

public record SignalResponse(SignalCombine combineMethod, List<SignalInputResponse> inputs) {
}
