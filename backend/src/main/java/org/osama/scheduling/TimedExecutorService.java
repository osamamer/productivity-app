package org.osama.scheduling;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.osama.pomodoro.PomodoroService;
import org.osama.session.SessionService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static javax.management.timer.Timer.ONE_SECOND;

@Service
@Slf4j
public class TimedExecutorService {

    private final ScheduledJobRepository scheduledJobRepository;
    private final PomodoroService pomodoroService;
    private final SessionService sessionService;

    @Getter
    private final Map<JobType, Consumer<String>> jobMap;


    public TimedExecutorService(ScheduledJobRepository scheduledJobRepository, SessionService sessionService, PomodoroService pomodoroService) {
        this.scheduledJobRepository = scheduledJobRepository;
        this.sessionService = sessionService;
        this.pomodoroService = pomodoroService;
        this.jobMap = createJobMap();
    }

    @Scheduled(fixedRate = ONE_SECOND)
    public void run() {
//        log.info("Checking for tasks between {} and {} to run", LocalDateTime.now().minusSeconds(5), LocalDateTime.now().plusSeconds(5));
        List<ScheduledJob> jobs = scheduledJobRepository.findAllByScheduledIsTrueAndDueDateBetween(LocalDateTime.now().minusSeconds(1),
                                LocalDateTime.now().plusSeconds(1));
        jobs.forEach(this::doJob);
    }

    private void doJob(ScheduledJob scheduledJob) {
        log.info("Performing {} job with ID [{}]", scheduledJob.getJobType(), scheduledJob.getJobId());
        Consumer<String> function = jobMap.get(scheduledJob.getJobType());
        function.accept(scheduledJob.getAssociatedTaskId());
        scheduledJob.setScheduled(false);
        scheduledJobRepository.save(scheduledJob);
    }

    private Map<JobType, Consumer<String>> createJobMap() {
        Map<JobType, Consumer<String>> jobMap = new HashMap<>();

        jobMap.put(JobType.START_SESSION, (taskId) -> sessionService.startSession(taskId, true));
        jobMap.put(JobType.END_SESSION, sessionService::endSession);
        jobMap.put(JobType.PAUSE_SESSION, sessionService::pauseSession);
        jobMap.put(JobType.UNPAUSE_SESSION, sessionService::unpauseSession);
        jobMap.put(JobType.END_POMODORO, pomodoroService::endPomodoro);


        return Map.copyOf(jobMap);
    }

}
