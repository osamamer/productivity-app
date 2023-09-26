package org.osama;

import lombok.Data;

import java.time.Duration;
import java.time.LocalDateTime;
@Data
public class Session {
    private final LocalDateTime startTime;
    private LocalDateTime endTime;
    private Duration timeElapsed;
    private boolean isRunning;
    public Session(LocalDateTime startTime) {
        this.startTime = startTime;
        this.isRunning = true;
    }
}
