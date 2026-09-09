package org.osama.task.recurrence;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/task-series")
public class TaskSeriesController {
    private final TaskSeriesService taskSeriesService;
    private final CurrentUserService currentUserService;

    public TaskSeriesController(TaskSeriesService taskSeriesService, CurrentUserService currentUserService) {
        this.taskSeriesService = taskSeriesService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/{seriesId}")
    public ResponseEntity<TaskSeriesResponse> getSeries(@PathVariable String seriesId) {
        return ResponseEntity.ok(taskSeriesService.getSeries(seriesId, currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{seriesId}")
    public ResponseEntity<TaskSeriesResponse> updateSeries(
            @PathVariable String seriesId,
            @RequestBody TaskSeriesUpdateRequest request
    ) {
        return ResponseEntity.ok(taskSeriesService.updateSeries(
                seriesId, request, currentUserService.getCurrentUserId()));
    }

    @DeleteMapping("/{seriesId}")
    public ResponseEntity<Void> stopSeries(@PathVariable String seriesId) {
        taskSeriesService.stopSeries(seriesId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
