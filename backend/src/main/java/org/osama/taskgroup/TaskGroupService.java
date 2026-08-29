package org.osama.taskgroup;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.mentalthread.MentalThread;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TaskGroupService {
    private final TaskGroupRepository groupRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskGroupService(TaskGroupRepository groupRepository, TaskRepository taskRepository,
                            UserRepository userRepository) {
        this.groupRepository = groupRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskGroupResponse> getGroups(String userId) {
        return groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .map(TaskGroupResponse::from)
                .toList();
    }

    @Transactional
    public TaskGroupResponse createGroup(String name, List<String> taskIds, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        List<Task> tasks = findOwnedTasks(taskIds, userId);
        detachTasksFromOtherGroups(taskIds, userId, null);

        TaskGroup group = new TaskGroup();
        group.setGroupId(UUID.randomUUID().toString());
        group.setUser(user);
        group.setName(validateName(name));
        group.setDisplayOrder(nextDisplayOrder(userId));
        group.setTasks(new LinkedHashSet<>(tasks));

        TaskGroup savedGroup = groupRepository.save(group);
        log.info("Task group created: userId={} groupId={} taskCount={}",
                userId, savedGroup.getGroupId(), savedGroup.getTasks().size());
        return TaskGroupResponse.from(savedGroup);
    }

    @Transactional
    public TaskGroupResponse addTaskToDefaultMentalThreadGroup(Task task, MentalThread mentalThread, String userId) {
        TaskGroup group = groupRepository
                .findByUserIdAndMentalThreadId(userId, mentalThread.getId())
                .orElseGet(() -> createDefaultGroup(mentalThread, userId));

        group.getTasks().add(task);
        TaskGroup savedGroup = groupRepository.save(group);
        log.info("Task added to mental-thread group: userId={} groupId={} taskId={} mentalThreadId={}",
                userId, savedGroup.getGroupId(), task.getTaskId(), mentalThread.getId());
        return TaskGroupResponse.from(savedGroup);
    }

    @Transactional
    public TaskGroupResponse renameGroup(String groupId, String name, String userId) {
        TaskGroup group = getGroupOrThrow(groupId, userId);
        group.setName(validateName(name));
        TaskGroup savedGroup = groupRepository.save(group);
        log.info("Task group renamed: userId={} groupId={}", userId, groupId);
        return TaskGroupResponse.from(savedGroup);
    }

    @Transactional
    public TaskGroupResponse replaceTasks(String groupId, List<String> taskIds, String userId) {
        TaskGroup group = getGroupOrThrow(groupId, userId);
        List<Task> tasks = findOwnedTasks(taskIds, userId);
        detachTasksFromOtherGroups(taskIds, userId, groupId);
        group.setTasks(new LinkedHashSet<>(tasks));
        TaskGroup savedGroup = groupRepository.save(group);
        log.info("Task group membership replaced: userId={} groupId={} taskCount={}",
                userId, groupId, savedGroup.getTasks().size());
        return TaskGroupResponse.from(savedGroup);
    }

    @Transactional
    public void removeTask(String groupId, String taskId, String userId) {
        TaskGroup group = getGroupOrThrow(groupId, userId);
        boolean removed = group.getTasks().removeIf(task -> task.getTaskId().equals(taskId));
        if (!removed) {
            return;
        }

        if (group.getTasks().size() < 2) {
            group.getTasks().clear();
            groupRepository.delete(group);
            log.info("Task removed from group and group deleted: userId={} groupId={} taskId={}",
                    userId, groupId, taskId);
            return;
        }

        TaskGroup savedGroup = groupRepository.save(group);
        log.info("Task removed from group: userId={} groupId={} taskId={} remainingTaskCount={}",
                userId, groupId, taskId, savedGroup.getTasks().size());
    }

    @Transactional
    public void deleteGroup(String groupId, String userId) {
        TaskGroup group = getGroupOrThrow(groupId, userId);
        group.getTasks().clear();
        groupRepository.delete(group);
        log.info("Task group deleted: userId={} groupId={}", userId, groupId);
    }

    @Transactional
    public void removeTasksFromGroups(Collection<String> taskIds, String userId) {
        if (taskIds == null || taskIds.isEmpty()) {
            return;
        }

        LinkedHashSet<String> taskIdsToRemove = new LinkedHashSet<>(taskIds);
        groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(group -> group.getTasks().removeIf(task -> taskIdsToRemove.contains(task.getTaskId())))
                .forEach(group -> {
                    // Manual groups need at least two tasks; mental-thread groups can remain
                    // as an empty/default container for the next connected task.
                    if (group.getMentalThreadId() == null && group.getTasks().size() < 2) {
                        group.getTasks().clear();
                        groupRepository.delete(group);
                    } else {
                        groupRepository.save(group);
                    }
                });
        log.info("Task group memberships removed: userId={} taskCount={}", userId, taskIdsToRemove.size());
    }

    private TaskGroup getGroupOrThrow(String groupId, String userId) {
        return groupRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task group not found: " + groupId));
    }

    private List<Task> findOwnedTasks(List<String> taskIds, String userId) {
        if (taskIds == null || taskIds.size() < 2
                || taskIds.stream().anyMatch(Objects::isNull)
                || taskIds.size() != taskIds.stream().distinct().count()) {
            throw new IllegalArgumentException("A task group must contain at least two unique tasks.");
        }

        List<Task> tasks = taskRepository.findAllByTaskIdInAndUserId(taskIds, userId);
        Map<String, Task> tasksById = tasks.stream()
                .collect(Collectors.toMap(Task::getTaskId, task -> task));
        if (tasksById.size() != taskIds.size()) {
            throw new IllegalArgumentException("All grouped tasks must belong to the current user.");
        }
        return taskIds.stream().map(tasksById::get).toList();
    }

    private void detachTasksFromOtherGroups(List<String> taskIds, String userId, String destinationGroupId) {
        LinkedHashSet<String> taskIdsToMove = new LinkedHashSet<>(taskIds);
        groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(group -> !group.getGroupId().equals(destinationGroupId))
                .filter(group -> group.getTasks().removeIf(task -> taskIdsToMove.contains(task.getTaskId())))
                .forEach(group -> {
                    if (group.getTasks().size() < 2) {
                        group.getTasks().clear();
                        groupRepository.delete(group);
                    } else {
                        groupRepository.save(group);
                    }
                });
    }

    private String validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A task group must have a name.");
        }
        if (name.trim().length() > 120) {
            throw new IllegalArgumentException("Task group names must be 120 characters or fewer.");
        }
        return name.trim();
    }

    private TaskGroup createDefaultGroup(MentalThread mentalThread, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        TaskGroup group = new TaskGroup();
        group.setGroupId(UUID.randomUUID().toString());
        group.setUser(user);
        group.setMentalThreadId(mentalThread.getId());
        group.setName(defaultGroupName(mentalThread));
        group.setDisplayOrder(nextDisplayOrder(userId));
        return group;
    }

    private String defaultGroupName(MentalThread mentalThread) {
        String title = mentalThread.getTitle().trim();
        return title.length() <= 120 ? title : title.substring(0, 117) + "...";
    }

    private int nextDisplayOrder(String userId) {
        return groupRepository.findTopByUserIdOrderByDisplayOrderDesc(userId)
                .map(group -> group.getDisplayOrder() + 1)
                .orElse(0);
    }
}
