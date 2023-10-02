package org.osama;

import jakarta.persistence.Embeddable;
import lombok.Data;

import java.time.Duration;
import java.time.LocalDateTime;
@Data
@Embeddable
public class Session {
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Duration timeElapsed;
    private boolean isRunning;
    public Session(LocalDateTime startTime) {
        this.startTime = startTime;
        this.isRunning = true;
    }

    public Session() {

    }
}
