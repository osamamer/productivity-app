package org.osama.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {
    Optional<Session> findSessionByTaskIdAndIsRunningIsTrue(String taskId);
    List<Session> findAllByTaskId(String taskId);
    List<Session> findAllByIsRunningIsTrue();
}
