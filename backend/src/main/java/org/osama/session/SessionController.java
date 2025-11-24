package org.osama.session;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/session")
@CrossOrigin(origins = "http://localhost:5173")
public class SessionController {
    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/start/{taskId}")
    public void startTaskSession(@PathVariable String taskId) {
        sessionService.startSession(taskId, false);
    }

    @PostMapping("/pause/{taskId}")
    public void pauseTaskSession(@PathVariable String taskId) {
        sessionService.pauseSession(taskId);
    }

    @PostMapping("/unpause/{taskId}")
    public void unpauseTaskSession(@PathVariable String taskId) {
        sessionService.unpauseSession(taskId);
    }

    @PostMapping("/end/{taskId}")
    public void endTaskSession(@PathVariable String taskId) {
        sessionService.endSession(taskId);
    }
}
