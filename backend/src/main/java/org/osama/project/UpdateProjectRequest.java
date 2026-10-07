package org.osama.project;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProjectRequest {
    private String name;
    private String description;
    private boolean namePresent;
    private boolean descriptionPresent;

    @JsonSetter("name")
    public void setName(String name) {
        this.name = name;
        this.namePresent = true;
    }

    @JsonSetter("description")
    public void setDescription(String description) {
        this.description = description;
        this.descriptionPresent = true;
    }
}
