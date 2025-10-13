package org.osama.pomodoro;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
public class Pomodoro {
    @Id
    @Column(nullable = false)
    private String pomodoroId;

    @Column(nullable = false, unique = true)
    private String associatedTaskId;

    @Column(nullable = false)
    private boolean isActive;

    @Column
    boolean isSessionActive;

    @Column
    boolean isSessionRunning;

    @Column
    int focusDuration;

    @Column
    int shortBreakDuration;

    @Column
    int longBreakDuration;

    @Column
    int numFocuses;

    @Column
    int longBreakCooldown;

    @Column
    int currentFocusNumber;

    @Column
    long secondsUntilNextTransition;

    @Column
    long secondsPassedInSession;


}
