package org.osama.pomodoro;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PomodoroSettings {
    private static final int NORMAL_FOCUS_DURATION = 25;
    private static final int NORMAL_SHORT_BREAK_DURATION = 5;
    private static final int NORMAL_LONG_BREAK_DURATION = 15;
    private static final int DEV_DURATION = 10;

    private final boolean devSecondsMode;

    public PomodoroSettings(
            @Value("${app.pomodoro.dev-seconds-mode:false}") boolean devSecondsMode) {
        this.devSecondsMode = devSecondsMode;
    }

    public boolean isDevSecondsMode() {
        return devSecondsMode;
    }

    public String getDurationUnit() {
        return devSecondsMode ? "seconds" : "minutes";
    }

    public int getDefaultFocusDuration() {
        return devSecondsMode ? DEV_DURATION : NORMAL_FOCUS_DURATION;
    }

    public int getDefaultShortBreakDuration() {
        return devSecondsMode ? DEV_DURATION : NORMAL_SHORT_BREAK_DURATION;
    }

    public int getDefaultLongBreakDuration() {
        return devSecondsMode ? DEV_DURATION : NORMAL_LONG_BREAK_DURATION;
    }

    public long durationInSeconds(int duration) {
        return durationInSeconds(duration, devSecondsMode);
    }

    public long durationInSeconds(int duration, boolean secondsMode) {
        return secondsMode ? duration : Math.multiplyExact((long) duration, 60L);
    }
}
