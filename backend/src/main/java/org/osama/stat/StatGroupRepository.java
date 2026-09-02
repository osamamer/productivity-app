package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StatGroupRepository extends JpaRepository<StatGroup, String> {
    List<StatGroup> findAllByUserIdOrderByDisplayOrderAsc(String userId);

    Optional<StatGroup> findByGroupIdAndUserId(String groupId, String userId);

    Optional<StatGroup> findTopByUserIdOrderByDisplayOrderDesc(String userId);
}
