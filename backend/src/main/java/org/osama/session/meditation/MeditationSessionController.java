package org.osama.session.meditation;

import org.osama.requests.StartMeditationRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;

@RestController
@RequestMapping("/api/v1/meditation")
@CrossOrigin(origins = "http://localhost:5173")
public class MeditationSessionController {
    private final MeditationSessionService meditationSessionService;

    public MeditationSessionController(MeditationSessionService meditationSessionService) {
        this.meditationSessionService = meditationSessionService;
    }
    @PostMapping("/start")
    public ResponseEntity<MeditationSession> startSession(@RequestBody @Valid StartMeditationRequest startMeditationRequest) {
        MeditationSession session = meditationSessionService
                .startSession(startMeditationRequest.getMood(), startMeditationRequest.getNumIntervalBells());
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
