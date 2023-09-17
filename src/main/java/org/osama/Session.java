package org.osama;

import java.time.LocalDateTime;

public class Session {
    private final LocalDateTime startTime;
    private LocalDateTime endTime;
    public Session(LocalDateTime startTime) {
        this.startTime = startTime;
    }
}
