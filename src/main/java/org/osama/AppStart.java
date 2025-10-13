package org.osama;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.task.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class AppStart {
    private final TaskService taskService;
    private final ScheduledJobRepository scheduledJobRepository;

    public AppStart(TaskService taskService, ScheduledJobRepository scheduledJobRepository) {
        this.taskService = taskService;
        this.scheduledJobRepository = scheduledJobRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReadyEvent(){
        log.info("Starting app");
        taskService.endAllSessions();
        scheduledJobRepository.deleteAll();
        log.info("Deleted all jobs.");

    }
}
