package org.osama.task;

public record TaskPageTaskDto(
        Task task,
        TaskPomodoroStatsResponse focusHistory
) {
}
