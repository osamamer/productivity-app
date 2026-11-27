package org.osama.path;

import org.osama.project.CheckpointResponse;

import java.time.LocalDate;
import java.util.List;

/**
 * A milestone as the Paths page draws it.
 *
 * @param doneOn   the day it was marked done, or else the day its last checkpoint was reached; null while open
 * @param progress 0 to 1: the mean of its checkpoints' progress, or of its tasks when it has no checkpoints
 */
public record MilestoneResponse(String id, String projectId, String name, LocalDate targetDate, int displayOrder,
                                boolean done, LocalDate doneOn, double progress, long taskCount, long completedTaskCount,
                                List<CheckpointResponse> checkpoints) {
}
