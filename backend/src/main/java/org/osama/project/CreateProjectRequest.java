package org.osama.project;

public record CreateProjectRequest(
        String name,
        String description,
        String color,
        String icon
) {
    public CreateProjectRequest(String name, String description) {
        this(name, description, null, null);
    }
}
