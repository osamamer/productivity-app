package org.osama.session.task;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.osama.session.Session;

@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
public class TaskSession extends Session {
    @Id
    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String associatedTaskId;

    @Column
    private String associatedPomodoroId;

    @Column
    private boolean pomodoro;



}
