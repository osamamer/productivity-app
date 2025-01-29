package org.osama.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {
    Optional<Session> findSessionByTaskIdAndRunningIsTrue(String taskId);
    Optional<Session> findSessionByTaskIdAndActiveIsTrue(String taskId);
    List<Session> findAllByTaskIdAndRunningIsTrue(String taskId);
    List<Session> findAllByTaskIdAndActiveIsTrue(String taskId);

    List<Session> findAllByTaskId(String taskId);
    List<Session> findAllByRunningIsTrue();
    List<Session> findAllByActiveIsTrue();
    int countAllByTaskIdAndActiveIsFalse(String taskId);
}
