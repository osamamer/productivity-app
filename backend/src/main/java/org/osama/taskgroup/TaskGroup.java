package org.osama.taskgroup;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.osama.task.Task;
import org.osama.user.User;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@org.hibernate.annotations.SQLDelete(sql = "UPDATE task_group SET soft_deleted = true WHERE group_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Table(name = "task_group")
public class TaskGroup {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "group_id", nullable = false)
    private String groupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(name = "mental_thread_id")
    private String mentalThreadId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<TaskGroupTask> taskMemberships = new LinkedHashSet<>();

    public Set<Task> getTasks() {
        return taskMemberships.stream()
                .map(TaskGroupTask::getTask)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void replaceTasks(Collection<Task> tasks) {
        var requestedTasks = tasks.stream()
                .collect(Collectors.toMap(Task::getTaskId, task -> task));
        taskMemberships.removeIf(membership -> !requestedTasks.containsKey(membership.getTask().getTaskId()));
        Set<String> currentTaskIds = taskMemberships.stream()
                .map(membership -> membership.getTask().getTaskId())
                .collect(Collectors.toSet());
        requestedTasks.values().stream()
                .filter(task -> !currentTaskIds.contains(task.getTaskId()))
                .forEach(this::addTask);
    }

    public void addTask(Task task) {
        boolean alreadyLinked = taskMemberships.stream()
                .anyMatch(membership -> membership.getTask().getTaskId().equals(task.getTaskId()));
        if (alreadyLinked) return;
        TaskGroupTask membership = new TaskGroupTask();
        membership.setGroup(this);
        membership.setTask(task);
        taskMemberships.add(membership);
    }

    public boolean removeTasks(Collection<String> taskIds) {
        return taskMemberships.removeIf(membership -> taskIds.contains(membership.getTask().getTaskId()));
    }

    public void clearTasks() {
        taskMemberships.clear();
    }

    public int taskCount() {
        return taskMemberships.size();
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
