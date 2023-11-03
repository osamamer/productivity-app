package org.osama.day;

import org.osama.session.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface DayRepository extends JpaRepository<Day, String> {
    Optional<Day> findDayByDate(LocalDateTime localDateTime);
}
