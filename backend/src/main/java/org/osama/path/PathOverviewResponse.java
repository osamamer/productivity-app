package org.osama.path;

import java.time.LocalDate;
import java.util.List;

/**
 * Everything the Paths page draws. Each path's weeks run oldest first and end with the current week;
 * milestones are in display order with their checkpoints.
 */
public record PathOverviewResponse(LocalDate today, PathViewResponse view, List<PathRoad> paths) {
    public record PathRoad(PathResponse path, List<WeekStrength> weeks, List<MilestoneResponse> milestones) {
    }
}
