package org.osama.session;

import org.osama.session.task.TaskSessionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/session")
@CrossOrigin(origins = "http://localhost:5173")
public class SessionController {
    private final TaskSessionService taskSessionService;

    public SessionController(TaskSessionService taskSessionService) {
        this.taskSessionService = taskSessionService;
    }

    @PostMapping("/start/{taskId}")
    public void startTaskSession(@PathVariable String taskId) {
        taskSessionService.startSession(taskId, false);
    }

    @PostMapping("/pause/{taskId}")
    public void pauseTaskSession(@PathVariable String taskId) {
        taskSessionService.pauseSession(taskId);
    }

    @PostMapping("/unpause/{taskId}")
    public void unpauseTaskSession(@PathVariable String taskId) {
        taskSessionService.unpauseSession(taskId);
    }

    @PostMapping("/end/{taskId}")
    public void endTaskSession(@PathVariable String taskId) {
        taskSessionService.endSession(taskId);
    }
}
