package org.osama.scheduling;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

@Data
@Entity
public class Pomodoro {
    @Id
    @Column(nullable = false)
    private String pomodoroId;
    @Column(nullable = false)
    private String taskId;
    @Column(nullable = false)
    private int focusDuration;
    @Column(nullable = false)
    private int shortBreakDuration;
    @Column(nullable = false)
    private int longBreakDuration;
    @Column(nullable = false)
    private int focusesRemaining;
    @Column(nullable = false)
    private int longBreakCooldown;
    @Column(nullable = false)
    private int timeRemainingInCurrentFocus;
}
