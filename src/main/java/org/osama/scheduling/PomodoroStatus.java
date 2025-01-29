package org.osama.scheduling;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PomodoroStatus {
    private String taskId;
    private String taskName;
    private boolean isSessionActive;
    private LocalDateTime nextTransitionTime;
    private int currentFocusNumber;
    private int totalFocuses;
    private long secondsUntilTransition;
}