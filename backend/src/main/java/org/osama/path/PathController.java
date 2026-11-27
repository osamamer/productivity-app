package org.osama.path;

import org.osama.user.CurrentUserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Paths and their signals. {@code today} is the caller's local date, so weeks follow the user's
 * calendar rather than the server's; it defaults to the server's date.
 */
@RestController
@RequestMapping("/api/v1/paths")
public class PathController {
    private final CurrentUserService currentUserService;
    private final PathService pathService;
    private final PathOverviewService overviewService;
    private final MilestoneService milestoneService;

    public PathController(CurrentUserService currentUserService, PathService pathService,
                          PathOverviewService overviewService, MilestoneService milestoneService) {
        this.currentUserService = currentUserService;
        this.pathService = pathService;
        this.overviewService = overviewService;
        this.milestoneService = milestoneService;
    }

    @GetMapping
    public List<PathResponse> getPaths() {
        return pathService.getPaths(currentUserService.getCurrentUserId());
    }

    @GetMapping("/overview")
    public PathOverviewResponse getOverview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return overviewService.getOverview(from, orToday(today), currentUserService.getCurrentUserId());
    }

    @PostMapping("/signal-preview")
    public SignalPreviewResponse previewSignal(
            @RequestBody SignalRequest request,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return overviewService.preview(request, orToday(today), currentUserService.getCurrentUserId());
    }

    @PutMapping("/view")
    public PathViewResponse updateView(@RequestBody PathViewRequest request) {
        return pathService.updateView(request, currentUserService.getCurrentUserId());
    }

    @PutMapping("/order")
    public List<PathResponse> reorder(@RequestBody List<String> pathIds) {
        return pathService.reorder(pathIds, currentUserService.getCurrentUserId());
    }

    @GetMapping("/{pathId}")
    public PathResponse getPath(@PathVariable String pathId) {
        return pathService.getPath(pathId, currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<PathResponse> createPath(@RequestBody PathRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(pathService.createPath(request, currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{pathId}")
    public PathResponse updatePath(@PathVariable String pathId, @RequestBody PathRequest request) {
        return pathService.updatePath(pathId, request, currentUserService.getCurrentUserId());
    }

    @PutMapping("/{pathId}/signal")
    public PathResponse replaceSignal(@PathVariable String pathId, @RequestBody SignalRequest request) {
        return pathService.replaceSignal(pathId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{pathId}")
    public ResponseEntity<Void> deletePath(@PathVariable String pathId) {
        pathService.deletePath(pathId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{pathId}/milestones")
    public ResponseEntity<MilestoneResponse> createMilestone(
            @PathVariable String pathId, @RequestBody MilestoneRequest request,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return ResponseEntity.status(HttpStatus.CREATED).body(milestoneService.createMilestone(
                pathId, request, orToday(today), currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{pathId}/milestones/{milestoneId}")
    public MilestoneResponse updateMilestone(
            @PathVariable String pathId, @PathVariable String milestoneId, @RequestBody MilestoneRequest request,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return milestoneService.updateMilestone(pathId, milestoneId, request, orToday(today),
                currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{pathId}/milestones/{milestoneId}")
    public ResponseEntity<Void> deleteMilestone(@PathVariable String pathId, @PathVariable String milestoneId) {
        milestoneService.deleteMilestone(pathId, milestoneId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    private static LocalDate orToday(LocalDate today) {
        return today == null ? LocalDate.now() : today;
    }
}
