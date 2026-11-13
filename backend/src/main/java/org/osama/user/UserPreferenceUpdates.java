package org.osama.user;

import java.time.LocalTime;

/**
 * Nullable fields represent a PATCH: omitted fields keep their current value.
 */
public record UserPreferenceUpdates(
        Boolean autoStartPomodoroSessions,
        Boolean checkupNotificationsEnabled,
        Boolean repeatCheckupNotificationsEnabled,
        Integer checkupIntervalMinutes,
        LocalTime checkupStartTime,
        Integer checkupTimesPerDay,
        String checkupTimeZone,
        String pomodoroSoundId,
        Boolean showCompletedHomeTasks,
        Boolean excludeTodayCompletedTasks,
        Boolean showClosedMentalThreads,
        Boolean soundEffectsEnabled,
        Boolean whiteNoiseEnabled,
        Boolean muteFocusNoiseDuringBreaks,
        Boolean pomodoroSecondsMode,
        Integer pomodoroLongBreakCooldown,
        Integer pomodoroFocusDuration,
        Integer pomodoroShortBreakDuration,
        Integer pomodoroLongBreakDuration,
        Integer pomodoroNumFocuses,
        Integer pomodoroTimeAdjustmentMinutes,
        String themeMode,
        String accentColor,
        Integer meditationDurationMinutes,
        Integer meditationIntervalBells,
        String meditationSound,
        Integer homeDayEndHour
) {
    public static UserPreferenceUpdates forPomodoroSound(String pomodoroSoundId) {
        return new UserPreferenceUpdates(
                null, null, null, null, null, null, null, pomodoroSoundId,
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
    }

    public boolean isEmpty() {
        return autoStartPomodoroSessions == null
                && checkupNotificationsEnabled == null
                && repeatCheckupNotificationsEnabled == null
                && checkupIntervalMinutes == null
                && checkupStartTime == null
                && checkupTimesPerDay == null
                && checkupTimeZone == null
                && pomodoroSoundId == null
                && showCompletedHomeTasks == null
                && excludeTodayCompletedTasks == null
                && showClosedMentalThreads == null
                && soundEffectsEnabled == null
                && whiteNoiseEnabled == null
                && muteFocusNoiseDuringBreaks == null
                && pomodoroSecondsMode == null
                && pomodoroLongBreakCooldown == null
                && pomodoroFocusDuration == null
                && pomodoroShortBreakDuration == null
                && pomodoroLongBreakDuration == null
                && pomodoroNumFocuses == null
                && pomodoroTimeAdjustmentMinutes == null
                && themeMode == null
                && accentColor == null
                && meditationDurationMinutes == null
                && meditationIntervalBells == null
                && meditationSound == null
                && homeDayEndHour == null;
    }
}
