package org.osama.path;

import java.util.List;

/** How an unsaved signal would have scored recent weeks, for the path editor. */
public record SignalPreviewResponse(SignalResponse signal, List<WeekStrength> weeks) {
}
