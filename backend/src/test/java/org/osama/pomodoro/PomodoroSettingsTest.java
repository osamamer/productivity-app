package org.osama.pomodoro;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PomodoroSettingsTest {

    @Test
    void disabledModeKeepsNormalMinuteDefaults() {
        PomodoroSettings settings = new PomodoroSettings(false);

        assertFalse(settings.isDevSecondsMode());
        assertEquals("minutes", settings.getDurationUnit());
        assertEquals(25, settings.getDefaultFocusDuration());
        assertEquals(5, settings.getDefaultShortBreakDuration());
        assertEquals(15, settings.getDefaultLongBreakDuration());
        assertEquals(120, settings.durationInSeconds(2));
        assertEquals(2, settings.durationInSeconds(2, true));
    }

    @Test
    void enabledModeUsesTenSecondDefaults() {
        PomodoroSettings settings = new PomodoroSettings(true);

        assertTrue(settings.isDevSecondsMode());
        assertEquals("seconds", settings.getDurationUnit());
        assertEquals(10, settings.getDefaultFocusDuration());
        assertEquals(10, settings.getDefaultShortBreakDuration());
        assertEquals(10, settings.getDefaultLongBreakDuration());
        assertEquals(2, settings.durationInSeconds(2));
        assertEquals(120, settings.durationInSeconds(2, false));
    }
}
