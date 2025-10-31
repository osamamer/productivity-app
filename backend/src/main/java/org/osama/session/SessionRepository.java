package org.osama.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {
    Session findSessionBySessionId(String sessionId);
    Optional<Session> findSessionByAssociatedTaskIdAndRunningIsTrue(String taskId);
    Optional<Session> findSessionByAssociatedTaskIdAndActiveIsTrue(String taskId);
    List<Session> findAllByAssociatedTaskIdAndRunningIsTrue(String taskId);
    List<Session> findAllByAssociatedTaskIdAndActiveIsTrue(String taskId);

    List<Session> findAllByAssociatedTaskId(String taskId);
    List<Session> findAllByRunningIsTrue();
    List<Session> findAllByActiveIsTrue();
    int countAllByAssociatedTaskIdAndActiveIsFalse(String taskId);

    boolean existsByAssociatedTaskIdAndRunningIsTrue(String taskId);
}
