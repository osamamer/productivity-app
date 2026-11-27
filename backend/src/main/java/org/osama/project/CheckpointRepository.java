package org.osama.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CheckpointRepository extends JpaRepository<Checkpoint, String> {
    List<Checkpoint> findAllByProjectIdInAndUserIdOrderByDisplayOrderAsc(Collection<String> projectIds, String userId);

    List<Checkpoint> findAllByProjectIdAndUserIdOrderByDisplayOrderAsc(String projectId, String userId);

    Optional<Checkpoint> findByIdAndUserId(String id, String userId);

    long countByProjectIdAndUserId(String projectId, String userId);

    @Modifying
    @Query("update Checkpoint c set c.softDeleted = true where c.projectId = :projectId and c.userId = :userId")
    int deleteAllOfProject(@Param("projectId") String projectId, @Param("userId") String userId);
}
