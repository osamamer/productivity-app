package org.osama.scheduling;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PomodoroStatus {
     String taskId;
     String taskName;
     boolean isSessionActive;
     boolean isSessionRunning;
     LocalDateTime nextTransitionTime;
     int currentFocusNumber;
     int totalFocuses;
     long secondsPassed;
     long secondsUntilTransition;
}