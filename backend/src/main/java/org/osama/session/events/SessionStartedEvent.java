package org.osama.session.events;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Duration;
import java.time.LocalDateTime;

// Session events
@Getter
@AllArgsConstructor
public class SessionStartedEvent {
    private final String taskId;
    private final String sessionId;
    private final boolean isPomodoro;
    private final LocalDateTime timestamp;
}
