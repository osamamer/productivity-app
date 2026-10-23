package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StatFocusTaskLinkRepository extends JpaRepository<StatFocusTaskLink, String> {

    List<StatFocusTaskLink> findAllByStatDefinitionIdOrderByTaskNameAsc(String statDefinitionId);

    @Query("select link from StatFocusTaskLink link where link.statDefinition.user.id = :userId")
    List<StatFocusTaskLink> findAllByUserId(@Param("userId") String userId);

    Optional<StatFocusTaskLink> findByStatDefinitionIdAndTaskNameIgnoreCase(
            String statDefinitionId, String taskName);

    @Query("select link from StatFocusTaskLink link "
            + "where lower(link.taskName) = lower(:taskName) "
            + "and link.statDefinition.user.id = :userId")
    List<StatFocusTaskLink> findAllByTaskNameAndUserIdIgnoreCase(
            @Param("taskName") String taskName, @Param("userId") String userId);

    void deleteAllByStatDefinitionId(String statDefinitionId);
}
