package org.osama.task;

import lombok.extern.slf4j.Slf4j;
import org.osama.session.Session;
import org.osama.session.SessionRepository;
import org.osama.requests.ModifyTaskRequest;
import org.osama.requests.NewTaskRequest;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
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
