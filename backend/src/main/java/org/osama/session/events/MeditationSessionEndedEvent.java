package org.osama.session.events;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Duration;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class MeditationSessionEndedEvent {
    private final String sessionId;
    private final String userId;
    private final Duration totalDuration;
    private final LocalDateTime timestamp;
}
