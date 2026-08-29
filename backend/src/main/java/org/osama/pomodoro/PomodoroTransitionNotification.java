package org.osama.pomodoro;

public record PomodoroTransitionNotification(
        String notificationId,
        String taskId,
        String taskName,
        PomodoroTransition transition
) {
}
