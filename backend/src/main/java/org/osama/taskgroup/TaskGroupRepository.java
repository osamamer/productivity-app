package org.osama.taskgroup;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskGroupRepository extends JpaRepository<TaskGroup, String> {
    List<TaskGroup> findAllByUserIdOrderByDisplayOrderAsc(String userId);

    Optional<TaskGroup> findByGroupIdAndUserId(String groupId, String userId);

    Optional<TaskGroup> findTopByUserIdOrderByDisplayOrderDesc(String userId);

    Optional<TaskGroup> findByUserIdAndMentalThreadId(String userId, String mentalThreadId);
}
