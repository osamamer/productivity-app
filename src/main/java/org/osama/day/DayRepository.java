package org.osama.day;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;
public interface DayRepository extends JpaRepository<DayEntity, String> {
    Optional<DayEntity> findDayEntityByLocalDate(LocalDate localDate);
}
