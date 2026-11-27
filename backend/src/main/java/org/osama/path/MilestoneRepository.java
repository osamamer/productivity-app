package org.osama.path;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MilestoneRepository extends JpaRepository<Milestone, String> {
    List<Milestone> findAllByPathIdInOrderByDisplayOrderAsc(Collection<String> pathIds);

    List<Milestone> findAllByPathIdOrderByDisplayOrderAsc(String pathId);

    Optional<Milestone> findByIdAndPathId(String id, String pathId);

    Optional<Milestone> findByProjectId(String projectId);

    long countByPathId(String pathId);
}
