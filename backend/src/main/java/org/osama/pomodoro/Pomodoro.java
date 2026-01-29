package org.osama.pomodoro;


import jakarta.persistence.*;
import lombok.Data;
import org.osama.user.User;

import java.time.LocalDateTime;

@Data
@Entity
public class Pomodoro {
    @Id
    @Column(nullable = false)
    private String pomodoroId;

    @Column(nullable = false)
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
