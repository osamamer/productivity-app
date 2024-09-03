package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.osama.scheduling.JobType;
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
        Task task = taskRepository.findTaskByTaskId(taskRequest.taskId);
        task.setDescription(taskRequest.taskDescription);
        taskRepository.save(task);
        log.info("Set new task description for task with ID [{}]", task.getTaskId());
    }

    public boolean getTaskRunning(String taskId) {
        return !sessionRepository.findAllByTaskIdAndRunningIsTrue(taskId).isEmpty();
    }
    public boolean getTaskActive(String taskId) {
        return !sessionRepository.findAllByTaskIdAndActiveIsTrue(taskId).isEmpty();
    }
    public void startTaskSession(String taskId, boolean isPomodoro) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        List<Session> activeSessions = sessionRepository.findAllByTaskIdAndActiveIsTrue(task.getTaskId());
        if (!activeSessions.isEmpty()) throw new IllegalStateException("Cannot start a session when a task is already active");
//        endAllSessions();
        Session session = createSession(task, isPomodoro);
        sessionRepository.save(session);
        log.info("Started session for task with ID [{}] on {}", task.getTaskId(), session.getStartTime());
    }
    public void pauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndRunningIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot pause task session because it is not running"));
        activeSession.setRunning(false);
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        activeSession.setLastPauseTime(LocalDateTime.now());
        if (activeSession.isPomodoro()) {
            unscheduleTaskJobs(taskId);
        }
        sessionRepository.save(activeSession);
        log.info("Paused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastPauseTime());
    }
    public void unpauseTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndRunningIsTrue(task.getTaskId());
        if (session.isPresent()) throw new IllegalStateException("Cannot unpause a session when the task is already running");
        session = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot unpause task session because it is not active"));
        activeSession.setRunning(true);
        activeSession.setLastUnpauseTime(LocalDateTime.now());
        if (activeSession.isPomodoro()) {
            shiftTaskJobDueDates(taskId, (int) ChronoUnit.SECONDS.between(activeSession.getLastPauseTime(), activeSession.getLastUnpauseTime()));
            rescheduleTaskJobs(taskId);
        }
        sessionRepository.save(activeSession);
        log.info("Unpaused task with ID [{}] on {}", task.getTaskId(), activeSession.getLastUnpauseTime());
    }
    public void endTaskSession(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        Optional<Session> session = sessionRepository.findSessionByTaskIdAndActiveIsTrue(taskId);
        Session activeSession = session.orElseThrow(() -> new IllegalStateException("Cannot end task session because it is not active"));
        Duration elapsedTime = Duration.between(activeSession.getLastUnpauseTime(), LocalDateTime.now());
        if (activeSession.isRunning()) {
            activeSession.setTotalSessionTime(activeSession.getTotalSessionTime().plus(elapsedTime));
        }
        activeSession.setEndTime(LocalDateTime.now());
        activeSession.setRunning(false);
        activeSession.setActive(false);
        sessionRepository.save(activeSession);
        log.info("Ended session for task with ID [{}] on {}", task.getTaskId(), activeSession.getEndTime());
    }
    public void completeTask(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        task.setCompleted(true);
        task.setCompletionDateTime(LocalDateTime.now());
        task.setCompletionDate(task.getCompletionDateTime().toLocalDate());
        taskRepository.save(task);
        log.info("Set complete status to true for task with ID [{}]", task.getTaskId());
    }
        public void uncompleteTask(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        task.setCompleted(false);
        task.setCompletionDateTime(null);
        taskRepository.save(task);
        log.info("Set complete status to false for task with ID [{}]", task.getTaskId());
    }
    public void toggleTaskCompletion(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        task.setCompleted(!task.isCompleted());
        taskRepository.save(task);
        log.info("Toggled completion to {} for task with ID [{}]", task.isCompleted(), taskId);
    }
    public boolean getTaskCompleted(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        return task.isCompleted();
    }
    public void changeTaskName(String taskId, String newName) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        task.setName(newName);
        taskRepository.save(task);
        log.info("Changed task name for task with ID [{}]", task.getTaskId());

    }
    public void setParentTask(String taskId, String parentId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        task.setParentId(parentId);
        taskRepository.save(task);
        log.info("Set task with ID [{}] to have parent with ID [{}]", task.getTaskId(), parentId);
    }
    public Task getParentTask(String taskId) {
        Task task = taskRepository.findTaskByTaskId(taskId);
        return taskRepository.findTaskByTaskId(task.getParentId());
    }
    public List<Task> getChildTasks(String taskId) {
        return taskRepository.findAllByParentId(taskId);
    }
    public List<Task> getNonCompletedTasks() {
        return taskRepository.findAllByCompletedIsFalseOrderByCreationDateTimeDesc();
    }
    public List<Task> getTodayTasks() {
        return taskRepository.findAllByCreationDateOrderByCreationDateTimeDesc(LocalDate.now());
    }
    public List<Task> getTasksByDate(String date) { // Now searches for the perform not creation date
        LocalDate localDate = stringToLocalDate(date);
        return taskRepository.findAllByScheduledPerformDateOrderByCompletedAscCreationDateTimeDesc(localDate);
    }
    public List<Task> getAllButDay(String date) {
        LocalDate localDate = stringToLocalDate(date);
        return taskRepository.findByCreationDateNot(localDate);
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
        return taskRepository.findFirstByCompletedIsFalseOrderByImportanceDescCreationDateTimeDesc();
    }
    public void startPomodoro(String taskId, int focusDuration,
                              int shortBreakDuration, int longBreakDuration,
                              int numFocuses, int longBreakCooldown) {
        startTaskSession(taskId, true);
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
                    createScheduledJob(JobType.END_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + focusDuration), taskId);
                timeElapsed += focusDuration;
            }
            else { // Meaning that we are in an odd iteration in which we are taking a break
                breaksTaken++;
                if (breaksTaken % longBreakCooldown != 0) { // Short break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + shortBreakDuration), taskId);
                    timeElapsed += shortBreakDuration;
                }
                else { // Long break
                    createScheduledJob(JobType.START_SESSION,
                            LocalDateTime.now().plusMinutes(timeElapsed + longBreakDuration), taskId);
                    timeElapsed += longBreakDuration;
                }
            }
        }
    }
    private void unscheduleTaskJobs(String taskId) { // For when the user pauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setScheduled(false);
            scheduledJobRepository.save(job);
        });
        log.info("Unscheduled jobs for task with ID [{}]", taskId);

    }
    private void rescheduleTaskJobs(String taskId) { // For when the user pauses
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setScheduled(true);
            scheduledJobRepository.save(job);
        });
        log.info("Rescheduled jobs for task with ID [{}]", taskId);

    }
    private void shiftTaskJobDueDates(String taskId, int shift) {
        List<ScheduledJob> taskJobs = scheduledJobRepository.findAllByAssociatedTaskId(taskId);
        taskJobs.forEach((job) -> {
            job.setDueDate(job.getDueDate().plusSeconds(shift));
            scheduledJobRepository.save(job);
            log.info("Shifted {} job to {}", job.getJobType(), job.getDueDate());
        });
    }
    private ScheduledJob createScheduledJob(JobType jobType, LocalDateTime dueDate, String taskId) {
        ScheduledJob scheduledJob = new ScheduledJob();
        scheduledJob.setJobId(UUID.randomUUID().toString());
        scheduledJob.setJobType(jobType);
        scheduledJob.setDueDate(dueDate);
        scheduledJob.setAssociatedTaskId(taskId);
        scheduledJob.setScheduled(true);
        scheduledJobRepository.save(scheduledJob);
        log.info("Scheduled {} job for task [{}] on {}", jobType.toString(), taskId, dueDate);
        return scheduledJob;
    }
    private static Session createSession(Task task, boolean isPomodoro) {
        Session session = new Session();
        session.setSessionId(UUID.randomUUID().toString());
        session.setTaskId(task.getTaskId());
        session.setStartTime(LocalDateTime.now());
        session.setTotalSessionTime(Duration.ZERO);
        session.setLastUnpauseTime(session.getStartTime());
        session.setActive(true);
        session.setRunning(true);
        session.setPomodoro(isPomodoro);
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
        newTask.setCreationDate(newTask.getCreationDateTime().toLocalDate());
        newTask.setCompleted(false);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MMM-dd HH:mm");
        if (!Objects.equals(taskRequest.taskPerformTime, "")) {
            log.info("Task perform time not null");
            try {
            LocalDateTime performTime = LocalDateTime.parse(taskRequest.taskPerformTime);
            newTask.setScheduledPerformDateTime(performTime);
            newTask.setScheduledPerformDate(newTask.getScheduledPerformDateTime().toLocalDate());
        } catch (DateTimeParseException e) {
            System.out.println("Invalid LocalDateTime format: " + taskRequest.taskPerformTime);
        }
        }
        else {
            newTask.setScheduledPerformDateTime(LocalDateTime.now());
            newTask.setScheduledPerformDate(newTask.getScheduledPerformDateTime().toLocalDate());
        }


        if (taskRequest.parentTaskId != null) {
            newTask.setParentId(taskRequest.parentTaskId);
        }
        if (taskRequest.taskTag != null) {
            newTask.setTag(taskRequest.taskTag);
        }
        newTask.setImportance(taskRequest.taskImportance);
        taskRepository.save(newTask);
        log.info("Created new task on {}.", newTask.getCreationDateTime());
        return newTask;
    }

    private static LocalDate stringToLocalDate(String dateString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        return LocalDate.parse(dateString, formatter);
    }


    public List<Task> getPastTasks() {
        return taskRepository.findAllByScheduledPerformDateBeforeOrderByCompletedAscCreationDateTimeDesc(LocalDate.now());

    }
    public List<Task> getFutureTasks() {
        return taskRepository.findAllByScheduledPerformDateAfterOrderByCompletedAscCreationDateTimeDesc(LocalDate.now());
    }
}
