package org.osama.project;

public record CreateProjectRequest(
        String name,
        String description
) {
}
