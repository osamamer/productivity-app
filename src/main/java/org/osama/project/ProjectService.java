package org.osama.project;

import java.time.LocalDateTime;
import java.util.UUID;

public class ProjectService {
    private final ProjectRepository projectRepository;
    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    public Project createProject(String projectName) {
        Project project = new Project();
        project.setProjectId(UUID.randomUUID().toString());
        project.setCreationDateTime(LocalDateTime.now());
        project.setName(projectName);
        return project;
    }
}
