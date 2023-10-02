package org.osama.task;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.osama.Day;
import org.osama.Session;

import java.util.List;
import java.util.UUID;

@Data
@Entity
public class Task {
    @Id
    @Column(nullable = false)
    private String taskId;
    @Column(nullable = false)
    private String name;
    @Column
    private String description;
    @Column
    private boolean isActive;
    @Column
    private long accumulatedTime;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<Session> sessions;
    @JdbcTypeCode(SqlTypes.JSON)
    private Session activeSession;
    @JdbcTypeCode(SqlTypes.JSON)
    private Day day;


    public static Task createNewTask(String name, String description) {
        Task task = new Task();
        task.name = name;
        task.description = description;
        task.taskId = UUID.randomUUID().toString();
        task.isActive = false;
        return task;
    }

    public static Task reconstruct(String id, String name, String description) {
        Task task = new Task();
        task.taskId = id;
        task.name = name;
        task.description = description;
        return task;
    }


}
