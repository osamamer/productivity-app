package org.osama.note;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BulkNoteRequest {
    private List<String> noteIds;
    private Boolean pinned;
    private String categoryId;
    private boolean categoryIdPresent;

    @JsonSetter("categoryId")
    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
        this.categoryIdPresent = true;
    }
}
