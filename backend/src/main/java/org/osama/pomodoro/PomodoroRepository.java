package org.osama.pomodoro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PomodoroRepository extends JpaRepository<Pomodoro, String> {
    Optional<Pomodoro> findPomodoroByAssociatedTaskIdAndIsActiveIsTrue(String associatedTaskId);

    Optional<Pomodoro> findPomodoroByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(String associatedTaskId, String userId);

    Optional<Pomodoro> findPomodoroByUserIdAndIsActiveIsTrue(String userId);

    List<Pomodoro> findAllByAssociatedTaskIdIn(Collection<String> associatedTaskIds);

    List<Pomodoro> findAllByAssociatedTaskIdInAndIsActiveIsTrue(Collection<String> associatedTaskIds);

    boolean existsByAssociatedTaskIdAndUserIdAndIsActiveIsTrue(String associatedTaskId, String userId);

    boolean existsByUserIdAndIsActiveIsTrue(String userId);

    Pomodoro findPomodoroByPomodoroId(String pomodoroId);
}
