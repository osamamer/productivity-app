package org.osama.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
@Repository
public interface TaskJpaRepository extends JpaRepository<Task, String> {
    List<Task> findAllByName(String name);

    List<Task> findAllByParentId(String taskId);
}
