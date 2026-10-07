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
@org.hibernate.annotations.SQLDelete(sql = "UPDATE task_session SET soft_deleted = true WHERE session_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
public class TaskSession extends Session {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

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
