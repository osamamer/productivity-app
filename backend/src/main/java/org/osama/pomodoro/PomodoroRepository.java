package org.osama.pomodoro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PomodoroRepository extends JpaRepository<Pomodoro, String> {
    Optional<Pomodoro> findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(String associatedTaskId);

    Optional<Pomodoro> findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(String associatedTaskId, String userId);

    boolean existsByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(String associatedTaskId, String userId);

    Pomodoro findPomodoroByPomodoroId(String pomodoroId);
}
