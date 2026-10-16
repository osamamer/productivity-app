package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StatEntryRepository extends JpaRepository<StatEntry, String> {

    Optional<StatEntry> findByStatDefinitionIdAndUserIdAndDate(String statDefinitionId, String userId, LocalDate date);

    List<StatEntry> findAllByStatDefinitionIdAndUserIdAndDateBetween(
            String statDefinitionId, String userId, LocalDate from, LocalDate to);

    List<StatEntry> findAllByStatDefinitionIdAndUserId(String statDefinitionId, String userId);

    List<StatEntry> findAllByUserIdAndDateBetween(String userId, LocalDate from, LocalDate to);

    List<StatEntry> findAllByUserIdAndDate(String userId, LocalDate date);

    @Query("select e.statDefinition.id, min(e.date) from StatEntry e where e.user.id = :userId group by e.statDefinition.id")
    List<Object[]> findFirstLoggedDatesByUserId(String userId);

    @Query("select min(e.date) from StatEntry e where e.statDefinition.id = :definitionId and e.user.id = :userId")
    LocalDate findFirstLoggedDate(String definitionId, String userId);
}
