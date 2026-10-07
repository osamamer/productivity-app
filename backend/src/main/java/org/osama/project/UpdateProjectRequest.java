package org.osama.project;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProjectRequest {
    private String name;
    private String description;
    private String color;
    private String icon;
    private boolean namePresent;
    private boolean descriptionPresent;
    private boolean colorPresent;
    private boolean iconPresent;

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

    @JsonSetter("color")
    public void setColor(String color) {
        this.color = color;
        this.colorPresent = true;
    }

    @JsonSetter("icon")
    public void setIcon(String icon) {
        this.icon = icon;
        this.iconPresent = true;
    }
}
