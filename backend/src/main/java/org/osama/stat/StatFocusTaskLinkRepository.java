package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StatFocusTaskLinkRepository extends JpaRepository<StatFocusTaskLink, String> {

    List<StatFocusTaskLink> findAllByStatDefinitionIdOrderByTaskNameAsc(String statDefinitionId);

    Optional<StatFocusTaskLink> findByStatDefinitionIdAndTaskNameIgnoreCase(
            String statDefinitionId, String taskName);

    void deleteAllByStatDefinitionId(String statDefinitionId);
}
