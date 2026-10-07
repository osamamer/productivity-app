package org.osama.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, String> {

    @Query("""
            select project from Project project
            where project.userId = :userId
            order by lower(project.name) asc, project.name asc, project.projectId asc
            """)
    List<Project> findAllByUserIdOrderByNameAsc(@Param("userId") String userId);

    Optional<Project> findByProjectIdAndUserId(String projectId, String userId);
}
