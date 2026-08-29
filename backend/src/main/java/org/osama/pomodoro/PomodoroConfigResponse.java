package org.osama.pomodoro;

public record PomodoroConfigResponse(
        boolean secondsMode,
        String durationUnit,
        int defaultFocusDuration,
        int defaultShortBreakDuration,
        int defaultLongBreakDuration
) {
}
