package org.osama.session.events;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.LocalDateTime;



@Getter
@AllArgsConstructor
public class SessionPausedEvent {
    private final String taskId;
    private final String sessionId;
    private final boolean isPomodoro;
    private final LocalDateTime timestamp;
}
