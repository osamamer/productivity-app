package org.osama.requests;

import lombok.Data;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class MoveTasksToParentRequest {
    @NotNull(message = "Task IDs are required")
    @Size(min = 1, max = 100, message = "Between 1 and 100 task IDs are required")
    private List<String> taskIds;

    /** A null parent detaches the tasks and makes them main tasks again. */
    private String parentId;
}
