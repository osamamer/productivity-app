package org.osama.session.events;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Duration;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class SessionUnpausedEvent {
    private final String taskId;
    private final String sessionId;
    private final boolean isPomodoro;
    private final Duration pauseDuration;
    private final LocalDateTime timestamp;
}
