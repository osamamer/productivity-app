package org.osama.pomodoro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PomodoroRepository extends JpaRepository<Pomodoro, String> {
    Optional<Pomodoro> findPomodoroByAssociatedTaskId(String associatedTaskId);

    Pomodoro findPomodoroByPomodoroId(String pomodoroId);
}
