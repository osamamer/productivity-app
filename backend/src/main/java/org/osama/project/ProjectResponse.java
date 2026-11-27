package org.osama.project;

import java.time.LocalDateTime;

public record ProjectResponse(
        String projectId,
        String name,
        String description,
        String color,
        String icon,
        LocalDateTime creationDateTime,
        LocalDateTime updatedAt,
        LocalDateTime completedAt,
        long taskCount,
        long completedTaskCount
) {
    public static ProjectResponse from(Project project, long taskCount, long completedTaskCount) {
        return new ProjectResponse(
                project.getProjectId(),
                project.getName(),
                project.getDescription(),
                project.getColor(),
                project.getIcon(),
                project.getCreationDateTime(),
                project.getUpdatedAt(),
                project.getCompletedAt(),
                taskCount,
                completedTaskCount
        );
    }
}
