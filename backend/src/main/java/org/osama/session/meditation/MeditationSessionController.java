package org.osama.session.meditation;

import org.osama.requests.StartMeditationRequest;
import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;

@RestController
@RequestMapping("/api/v1/meditation")
public class MeditationSessionController {
    private final MeditationSessionService meditationSessionService;
    private final CurrentUserService currentUserService;

    public MeditationSessionController(MeditationSessionService meditationSessionService, CurrentUserService currentUserService) {
        this.meditationSessionService = meditationSessionService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/start")
    public ResponseEntity<MeditationSession> startSession(@RequestBody @Valid StartMeditationRequest startMeditationRequest) {
        MeditationSession session = meditationSessionService
                .startSession(startMeditationRequest.getMood(), startMeditationRequest.getNumIntervalBells(), currentUserService.getCurrentUserId());
        URI location = URI.create("/api/v1/meditation/" + session.getId());
        return ResponseEntity.created(location).build();
    }

    @PatchMapping("/{sessionId}/pause")
    public ResponseEntity<MeditationSession> pauseSession(@PathVariable String sessionId) {
        MeditationSession session = meditationSessionService.pauseSession(sessionId);
        return ResponseEntity.ok(session);
    }

    @PatchMapping("/{sessionId}/unpause")
    public ResponseEntity<MeditationSession> unpauseSession(@PathVariable String sessionId) {
        MeditationSession session = meditationSessionService.unpauseSession(sessionId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<MeditationSession> endSession(@PathVariable String sessionId) {
        MeditationSession session = meditationSessionService.endSession(sessionId);
        return ResponseEntity.ok(session);
    }
}
