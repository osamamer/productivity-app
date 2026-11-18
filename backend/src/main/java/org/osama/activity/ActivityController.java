package org.osama.activity;

import org.osama.user.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/activities")
public class ActivityController {
    private final CurrentUserService currentUserService;
    private final ActivityService activityService;

    public ActivityController(CurrentUserService currentUserService, ActivityService activityService) {
        this.currentUserService = currentUserService;
        this.activityService = activityService;
    }

    @GetMapping
    public List<ActivityResponse> getActivities() {
        return activityService.getActivities(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<ActivityResponse> createActivity(@RequestBody ActivityRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(activityService.createActivity(request, currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{activityId}")
    public ActivityResponse updateActivity(@PathVariable String activityId, @RequestBody ActivityRequest request) {
        return activityService.updateActivity(activityId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{activityId}")
    public ResponseEntity<Void> deleteActivity(@PathVariable String activityId) {
        activityService.deleteActivity(activityId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
