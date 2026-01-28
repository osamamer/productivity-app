package org.osama.session.task;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TaskSessionRepository extends JpaRepository<TaskSession, String> {
    TaskSession findSessionBySessionId(String sessionId);
    Optional<TaskSession> findSessionByAssociatedTaskIdAndRunningIsTrue(String taskId);
    Optional<TaskSession> findSessionByAssociatedTaskIdAndActiveIsTrue(String taskId);
    List<TaskSession> findAllByAssociatedTaskIdAndRunningIsTrue(String taskId);
    List<TaskSession> findAllByAssociatedTaskIdAndActiveIsTrue(String taskId);

    List<TaskSession> findAllByAssociatedTaskId(String taskId);
    List<TaskSession> findAllByRunningIsTrue();
    List<TaskSession> findAllByActiveIsTrue();
    int countAllByAssociatedTaskIdAndActiveIsFalse(String taskId);

    boolean existsByAssociatedTaskIdAndRunningIsTrue(String taskId);
}
