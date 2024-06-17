package org.osama.scheduling;

import org.osama.session.Session;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PomodoroRepository extends JpaRepository<Pomodoro, String> {

}
