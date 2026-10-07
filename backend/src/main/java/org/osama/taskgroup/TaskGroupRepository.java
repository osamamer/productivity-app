package org.osama.taskgroup;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskGroupRepository extends JpaRepository<TaskGroup, String> {
    List<TaskGroup> findAllByUserIdOrderByDisplayOrderAsc(String userId);

    Optional<TaskGroup> findByGroupIdAndUserId(String groupId, String userId);

    Optional<TaskGroup> findTopByUserIdOrderByDisplayOrderDesc(String userId);

    Optional<TaskGroup> findByUserIdAndMentalThreadId(String userId, String mentalThreadId);

    @Modifying
    @Query("update TaskGroup taskGroup set taskGroup.mentalThreadId = null "
            + "where taskGroup.mentalThreadId = :threadId and taskGroup.softDeleted = false")
    int clearMentalThreadAssignments(@Param("threadId") String threadId);
}
