package org.osama.scheduling;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScheduledJobRepository extends JpaRepository<ScheduledJob, String> {
    public List<ScheduledJob> findAllByDueDateBetween(LocalDateTime intervalStart, LocalDateTime intervalEnd);

}
