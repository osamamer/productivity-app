package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StatEntryRepository extends JpaRepository<StatEntry, String> {

    Optional<StatEntry> findByStatDefinitionIdAndUserIdAndDate(String statDefinitionId, String userId, LocalDate date);

    List<StatEntry> findAllByStatDefinitionIdAndUserIdAndDateBetween(
            String statDefinitionId, String userId, LocalDate from, LocalDate to);

    List<StatEntry> findAllByUserIdAndDate(String userId, LocalDate date);
}
