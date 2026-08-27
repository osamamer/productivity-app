package org.osama.note;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateNoteRequest {
    private String title;
    private String content;
    private String categoryId;
    private Boolean pinned;
    private boolean categoryIdPresent;

    @JsonSetter("categoryId")
    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
        this.categoryIdPresent = true;
    }
}
