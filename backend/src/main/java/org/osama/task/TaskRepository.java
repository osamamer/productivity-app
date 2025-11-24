package org.osama.task;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, String>,
                                        JpaSpecificationExecutor<Task> {

    Optional<Task> findTaskByTaskId(String taskId);

    void deleteTaskByTaskId(String taskId);


}


