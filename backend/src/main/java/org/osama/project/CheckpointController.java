package org.osama.project;

import org.osama.user.CurrentUserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/** A project's checkpoints. {@code today} is the caller's local date, used to measure progress. */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/checkpoints")
public class CheckpointController {
    private final CurrentUserService currentUserService;
    private final CheckpointService checkpointService;

    public CheckpointController(CurrentUserService currentUserService, CheckpointService checkpointService) {
        this.currentUserService = currentUserService;
        this.checkpointService = checkpointService;
    }

    @GetMapping
    public List<CheckpointResponse> getCheckpoints(@PathVariable String projectId,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return checkpointService.getCheckpoints(projectId, orToday(today), currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<CheckpointResponse> createCheckpoint(@PathVariable String projectId, @RequestBody CheckpointRequest request,
                                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return ResponseEntity.status(HttpStatus.CREATED).body(checkpointService.createCheckpoint(
                projectId, request, orToday(today), currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{checkpointId}")
    public CheckpointResponse updateCheckpoint(@PathVariable String projectId, @PathVariable String checkpointId,
                                               @RequestBody CheckpointRequest request,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return checkpointService.updateCheckpoint(projectId, checkpointId, request, orToday(today),
                currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{checkpointId}")
    public ResponseEntity<Void> deleteCheckpoint(@PathVariable String projectId, @PathVariable String checkpointId) {
        checkpointService.deleteCheckpoint(projectId, checkpointId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    private static LocalDate orToday(LocalDate today) {
        return today == null ? LocalDate.now() : today;
    }
}
