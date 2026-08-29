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

    @GetMapping("/config")
    public PomodoroConfigResponse getConfig() {
        return pomodoroService.getConfig();
    }

    @PostMapping("/start")
    public void startPomodoro(@RequestBody PomodoroRequest pomodoroRequest) {
        pomodoroService.startPomodoro(pomodoroRequest.taskId, pomodoroRequest.focusDuration,
                pomodoroRequest.shortBreakDuration, pomodoroRequest.longBreakDuration,
                pomodoroRequest.numFocuses, pomodoroRequest.longBreakCooldown,
                pomodoroRequest.secondsMode, currentUserService.getCurrentUserId());
    }

    @PostMapping("/end/{taskId}")
    public void endPomodoro(@PathVariable String taskId) {
        pomodoroService.endPomodoro(taskId, currentUserService.getCurrentUserId());
    }

    @PostMapping("/phase/start/{taskId}")
    public void startNextPhase(@PathVariable String taskId) {
        pomodoroService.startNextPhase(taskId, currentUserService.getCurrentUserId());
    }

    @PostMapping("/phase/finish-break/{taskId}")
    public void finishBreakEarly(@PathVariable String taskId) {
        pomodoroService.finishBreakEarly(taskId, currentUserService.getCurrentUserId());
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<Pomodoro> getStatus(@PathVariable String taskId) {
        return pomodoroService.getActivePomodoro(taskId, currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/status")
    public ResponseEntity<Pomodoro> getStatus() {
        return pomodoroService.getActivePomodoro(currentUserService.getCurrentUserId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
