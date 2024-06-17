package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.JobType;
import org.osama.scheduling.Pomodoro;
import org.osama.scheduling.ScheduledJob;
import org.osama.scheduling.ScheduledJobRepository;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.osama.task.requests.ModifyTaskRequest;
import org.osama.task.requests.NewTaskRequest;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
public class TaskService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final ScheduledJobRepository scheduledJobRepository;


    public TaskService(TaskRepository taskRepository, SessionRepository sessionRepository, ScheduledJobRepository scheduledJobRepository) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
        this.scheduledJobRepository = scheduledJobRepository;
    }

    public Duration getAccumulatedTime(String taskId) {
        Duration totalDuration = Duration.ZERO;
        List<Session> sessionList = sessionRepository.findAllByTaskId(taskId);
        for (Session session : sessionList) {
            totalDuration = totalDuration.plus(session.getTotalSessionTime());
        }
        return totalDuration;
    }
    public void setTaskDescription(ModifyTaskRequest taskRequest) {
        Task task = taskRepository.getTaskById(taskRequest.taskId);
        task.setDescription(taskRequest.taskDescription);
        taskRepository.update(task);
        log.info("Set new task description for task with ID [{}]", task.getTaskId());
    }

    public boolean getTaskRunning(String taskId) {
        return !sessionRepository.findAllByTaskIdAndIsRunningIsTrue(taskId).isEmpty();
    }
    public boolean getTaskActive(String taskId) {
        return !sessionRepository.findAllByTaskIdAndIsActiveIsTrue(taskId).isEmpty();
    }
    public void startTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        List<Session> activeSessions = sessionRepository.findAllByTaskIdAndIsActiveIsTrue(task.getTaskId());
        if (activeSessions.size() != 0) throw new IllegalStateException("Cannot start a session when a task is already active");
//        endAllSessions();
        sessionRepository.save(createSession(task));
        log.info("Started task with ID [{}]", task.getTaskId());
    }
    public void pauseTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot pause task session because it is not running"));
        activeSession.setRunning(false);
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        activeSession.setLastPauseTime(LocalDateTime.now());
        if (activeSession.isPomodoro()) {
            unscheduleTaskJobs(taskId);
        }
        sessionRepository.save(activeSession);
        log.info("Paused task with ID [{}]", task.getTaskId());
    }
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already running");
        session = sessionRepository.findSessionByTaskIdAndIsActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        if (activeSession.isPomodoro()) {
            shiftTaskJobDueDates(taskId, (int) ChronoUnit.MINUTES.between(activeSession.getLastPauseTime(), activeSession.getLastUnpauseTime()));
            rescheduleTaskJobs(taskId);
        }
        sessionRepository.save(activeSession);
        log.info("Unpaused task with ID [{}]", task.getTaskId());
    }
    public void endTaskSession(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndIsActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not active"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        if (activeSession.isRunning()) {
            activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        }
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        log.info("Ended session for task with ID [{}]", task.getTaskId());
    }
    public void completeTask(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        task.setCompleted(true);
        task.setCompletionDateTime(LocalDateTime.now());
        taskRepository.update(task);
        log.info("Set complete status to true for task with ID [{}]", task.getTaskId());
    }
    public boolean getTaskCompleted(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        return task.isCompleted();
    }
    public void changeTaskName(String taskId, String newName) {
        Task task = taskRepository.getTaskById(taskId);
        task.setName(newName);
        taskRepository.update(task);
        log.info("Changed task name for task with ID [{}]", task.getTaskId());

    }
    public void setParentTask(String taskId, String parentId) {
        Task task = taskRepository.getTaskById(taskId);
        task.setParentId(parentId);
        taskRepository.update(task);
        log.info("Set task with ID [{}] to have parent with ID [{}]", task.getTaskId(), parentId);
    }
    public Task getParentTask(String taskId) {
        Task task = taskRepository.getTaskById(taskId);
        return taskRepository.getTaskById(task.getParentId());
    }
    public List<Task> getChildTasks(String taskId) {
        return taskRepository.getChildTasks(taskId);
    }
    public List<Task> getNonCompletedTasks() {
        return taskRepository.getNonCompletedTasks();
    }
    public List<Task> getTodayTasks() {
        return taskRepository.getTodayTasks();
    }
    public List<Task> getTasksByDate(String date) {
        LocalDate localDate = stringToLocalDate(date);
        return taskRepository.getTasksByDate(localDate);
    }
    public List<Task> getNonCompletedTasksByDate(String date) {
        log.info("Getting uncompleted tasks for date [{}]", date);
        List<Task> taskList = getTasksByDate(date);
        List<Task> nonCompletedList = new ArrayList<>();
        for (Task task : taskList) {
            if (!task.isCompleted())
                nonCompletedList.add(task);
        }
        return nonCompletedList;
    }
    public Task getNewestUncompletedHighestPriorityTask() {
        return taskRepository.getNewestUncompletedHighestPriorityTask();
    }
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown) {

        Pomodoro pomodoro = createPomodoro(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
        startTaskSession(taskId);
        schedulePomoJobs(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown);
    }
    private void schedulePomoJobs(String taskId, int focusDuration,
                                  int shortBreakDuration, int longBreakDuration,
                                  int numFocuses, int longBreakCooldown) {
        // Why are we even using the same session? What is actually the point? Why not different sessions?
        int n = 2*numFocuses-1;
        int timeElapsed = 0;
        int breaksTaken = 0;
        for (int i = 0; i < n; i++) {
            if (i % 2 == 0) { // Meaning that are in an even iteration in which the task is active
                if (i == n - 1) {
                    createScheduledJob(JobType.END_TASK,
                            LocalDateTime.now().plusMinutes(timeElapsed + focusDuration), taskId);
                    break;
                }
                createScheduledJob(JobType.PAUSE_TASK,
                        LocalDateTime.now().plusMinutes(timeElapsed + focusDuration), taskId);
                timeElapsed += focusDuration;
            }
            else { // Meaning that we are in an odd iteration in which we are taking a break
                breaksTaken++;
                if (breaksTaken % longBreakCooldown != 0) { // Short break
                    createScheduledJob(JobType.UNPAUSE_TASK,
                            LocalDateTime.now().plusMinutes(timeElapsed + shortBreakDuration), taskId);

                    timeElapsed += shortBreakDuration;
                }
                else { // Long break
                    createScheduledJob(JobType.UNPAUSE_TASK,
                            LocalDateTime.now().plusMinutes(timeElapsed + longBreakDuration), taskId);
                    timeElapsed += longBreakDuration;
                }
            }
        }
    }
    public void unscheduleTaskJobs(String taskId) { // For when the user pauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> job.setScheduled(false));
    }
    public void rescheduleTaskJobs(String taskId) { // For when the user pauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> job.setScheduled(true));
    }
    public void shiftTaskJobDueDates(String taskId, int shift) {
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> job.setDueDate(job.getDueDate().plusMinutes(shift)));
    }
    private Pomodoro createPomodoro(String taskId, int focusDuration,
                                    int shortBreakDuration, int longBreakDuration,
                                    int numFocuses, int longBreakCooldown) {
        Pomodoro pomodoro = new Pomodoro();
        pomodoro.setPomodoroId(UUID.randomUUID().toString());
        pomodoro.setTaskId(taskId);
        pomodoro.setFocusDuration(focusDuration);
        pomodoro.setShortBreakDuration(shortBreakDuration);
        pomodoro.setLongBreakCooldown(longBreakDuration);
        pomodoro.setFocusesRemaining(numFocuses);
        pomodoro.setLongBreakCooldown(longBreakCooldown);
        pomodoro.setTimeRemainingInCurrentFocus(focusDuration);
        return pomodoro;
    }
    private ScheduledJob createScheduledJob(JobType jobType, LocalDateTime dueDate, String taskId) {
        log.info("Creating scheduled job");
        ScheduledJob scheduledJob = new ScheduledJob();
        scheduledJob.setJobId(UUID.randomUUID().toString());
        scheduledJob.setJobType(jobType);
        scheduledJob.setDueDate(dueDate);
        scheduledJob.setAssociatedTaskId(taskId);
        scheduledJobRepository.save(scheduledJob);
        log.info("Scheduled {} job for task [{}] on {}", jobType.toString(), taskId, dueDate);
        return scheduledJob;
    }
    private static Session createSession(Task task) {
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setTaskId(task.getTaskId());
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        log.info("Created session for task with ID [{}]", task.getTaskId());
        return session;
    }

    public void endAllSessions() {
        sessionRepository.findAll()
                .stream().filter(Session::isActive)
                .forEach(activeSession -> {
            activeSession.setEndTime(LocalDateTime.now());
            activeSession.setRunning(false);
            activeSession.setActive(false);
            sessionRepository.save(activeSession);
        });
        log.info("Ended all sessions.");

    }
    public Task createNewTask(NewTaskRequest taskRequest) {
        Task newTask = new Task();
        newTask.setTaskId(UUID.randomUUID().toString());
        newTask.setName(taskRequest.getTaskName());
        if (taskRequest.taskDescription != null) {
            newTask.setDescription(taskRequest.getTaskDescription());
        }
        newTask.setCreationDateTime(LocalDateTime.now(TimeZone.getDefault().toZoneId()));
        log.info(String.valueOf(TimeZone.getDefault()));
        log.info("TASK CREATION DATE TIME: {}", newTask.getCreationDateTime());
        newTask.setCreationDate(newTask.getCreationDateTime().toLocalDate());
        newTask.setCompleted(false);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MMM-dd HH:mm");

        try {
            LocalDateTime performTime = LocalDateTime.parse(taskRequest.taskPerformTime);
            newTask.setScheduledPerformDateTime(performTime);
        } catch (DateTimeParseException e) {
            System.out.println("Invalid LocalDateTime format: " + taskRequest.taskPerformTime);
        }
        if (taskRequest.parentTaskId != null) {
            newTask.setParentId(taskRequest.parentTaskId);
        }
        if (taskRequest.taskTag != null) {
            newTask.setTag(taskRequest.taskTag);
        }
        newTask.setImportance(taskRequest.taskImportance);
        taskRepository.add(newTask);
        log.info("Created new task on {}.", newTask.getCreationDate());
        return newTask;
    }

    private static LocalDate stringToLocalDate(String dateString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        return LocalDate.parse(dateString, formatter);
    }



}
