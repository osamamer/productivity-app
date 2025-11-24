package org.osama.pomodoro;

import org.osama.requests.PomodoroRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pomodoro")
@CrossOrigin(origins = "http://localhost:5173")
public class PomodoroController {
    private final PomodoroService pomodoroService;

    public PomodoroController(PomodoroService pomodoroService) {
        this.pomodoroService = pomodoroService;
    }

    @PostMapping("/start")
    public void startPomodoro(@RequestBody PomodoroRequest pomodoroRequest) {
        pomodoroService.startPomodoro(pomodoroRequest.taskId, pomodoroRequest.focusDuration,
                pomodoroRequest.shortBreakDuration, pomodoroRequest.longBreakDuration,
                pomodoroRequest.numFocuses, pomodoroRequest.longBreakCooldown);
    }

    @PostMapping("/end/{taskId}")
    public void endPomodoro(@PathVariable String taskId) {
        pomodoroService.endPomodoro(taskId);
    }
}
