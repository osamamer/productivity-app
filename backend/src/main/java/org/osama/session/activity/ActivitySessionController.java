package org.osama.session.activity;

import org.osama.user.CurrentUserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/activity-sessions")
public class ActivitySessionController {
    private final CurrentUserService currentUserService;
    private final ActivitySessionService sessionService;

    public ActivitySessionController(CurrentUserService currentUserService, ActivitySessionService sessionService) {
        this.currentUserService = currentUserService;
        this.sessionService = sessionService;
    }

    /** The running or paused timer, or 204 when there is none. */
    @GetMapping("/current")
    public ResponseEntity<ActivitySessionResponse> getCurrent() {
        return sessionService.getCurrent(currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping
    public List<ActivitySessionResponse> getBetween(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return sessionService.getBetween(currentUserService.getCurrentUserId(), from, to);
    }

    @PostMapping
    public ActivitySessionResponse start(@RequestBody StartActivitySessionRequest request) {
        return sessionService.start(request, currentUserService.getCurrentUserId());
    }

    @PostMapping("/{sessionId}/pause")
    public ActivitySessionResponse pause(@PathVariable String sessionId) {
        return sessionService.pause(sessionId, currentUserService.getCurrentUserId());
    }

    @PostMapping("/{sessionId}/resume")
    public ActivitySessionResponse resume(@PathVariable String sessionId) {
        return sessionService.resume(sessionId, currentUserService.getCurrentUserId());
    }

    @PostMapping("/{sessionId}/end")
    public ActivitySessionResponse end(@PathVariable String sessionId) {
        return sessionService.end(sessionId, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> delete(@PathVariable String sessionId) {
        sessionService.delete(sessionId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
