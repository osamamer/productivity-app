package org.osama.pomodoro;

import org.osama.requests.PomodoroRequest;
import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pomodoro")
public class PomodoroController {
    private final PomodoroService pomodoroService;
    private final CurrentUserService currentUserService;

    public PomodoroController(PomodoroService pomodoroService, CurrentUserService currentUserService) {
        this.pomodoroService = pomodoroService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/start")
    public void startPomodoro(@RequestBody PomodoroRequest pomodoroRequest) {
        pomodoroService.startPomodoro(pomodoroRequest.taskId, pomodoroRequest.focusDuration,
                pomodoroRequest.shortBreakDuration, pomodoroRequest.longBreakDuration,
                pomodoroRequest.numFocuses, pomodoroRequest.longBreakCooldown, currentUserService.getCurrentUserId());
    }

    @PostMapping("/end/{taskId}")
    public void endPomodoro(@PathVariable String taskId) {
        pomodoroService.endPomodoro(taskId);
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<Pomodoro> getStatus(@PathVariable String taskId) {
        return pomodoroService.getActivePomodoro(taskId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
