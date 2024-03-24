package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.filters.RemoteIpFilter;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class TaskService {
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;

    public TaskService(TaskRepository taskRepository, SessionRepository sessionRepository) {
        this.taskRepository = taskRepository;
        this.sessionRepository = sessionRepository;
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
        if (activeSessions.size() != 0) throw new IllegalStateException("Cannot start a session when the task is already active");
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
        List<Task> taskList = getTasksByDate(date);
        List<Task> nonCompletedList = new ArrayList<>();
        for (Task task : taskList) {
            if (!task.isCompleted())
                nonCompletedList.add(task);
        }
        return nonCompletedList;
    }
    @SuppressWarnings("InfiniteLoopStatement")
    public void startPomodoroSession(String taskId, int focusDurationMinutes, int numOfFocusPeriods, int breakDuration) {
        final int[] remainingFocuses = {numOfFocusPeriods}; // In order to be mutable and usable within inner class
        Task task = taskRepository.getTaskById(taskId);
        startTaskSession(taskId);
        Timer timer  = new Timer();
        TimerTask timerUnpause = new TimerTask() {
            @Override
            public void run() {
                unpauseTaskSession(taskId);
            }
        };
        TimerTask timerPause = new TimerTask() {
            @Override
            public void run() {
                pauseTaskSession(taskId);
                remainingFocuses[0]--;
            }
        };
        while (remainingFocuses[0] > 0) {
            timer.schedule(timerPause, focusDurationMinutes*60*1000L);
            
        }

        for (int remainingFocus : remainingFocuses) { // Type iter for foreach shortcut

        }
        for (int i = numOfFocusPeriods; i > 0; i--) {
            timer.schedule(timerPause, );
        }
        
        timer.schedule(timerPause, focusDurationMinutes* 1000L);
        timer.schedule(timerUnpause, (focusDurationMinutes + breakDuration)*1000L);
//        timer.schedule();
        // Perpetually check for user pausing or ending task
//        new Thread(new Runnable() {
//            @Override
//            public void run() {
//                while(true) {
//                    try {
//                        Thread.sleep(1000);
//                    } catch (InterruptedException e) {
//                        throw new RuntimeException(e);
//                    }
//                    if (!getTaskActive(taskId) && getTaskRunning(taskId)) {
//                        timer.cancel();
//                    }
//                    else if (!getTaskRunning(taskId)) {
//                        timer.cancel();
//                    }
//                }
//            }
//        }).start();
    }
    public void unpauseTimer(Timer timer, function, int duration) {
        timer.schedule(timerUnpause, duration*1000L);
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
        newTask.setDescription(taskRequest.getTaskDescription());
        newTask.setCreationDateTime(LocalDateTime.now());
        newTask.setCreationDate(newTask.getCreationDateTime().toLocalDate());
        newTask.setCompleted(false);
        taskRepository.add(newTask);
        log.info("Created new task.");
        return newTask;
    }
    private static LocalDate stringToLocalDate(String dateString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        return LocalDate.parse(dateString, formatter);
    }



}
