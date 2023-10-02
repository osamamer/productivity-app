package org.osama.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskJpaRepository extends JpaRepository<Task, String> {
    List<Task> findAllByName(String name);
}
