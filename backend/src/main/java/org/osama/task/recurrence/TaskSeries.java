package org.osama.task.recurrence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Entity
@Table(name = "task_series")
public class TaskSeries {
    @Id
    @Column(name = "series_id", nullable = false)
    private String seriesId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column
    private String tag;

    @Column(nullable = false)
    private int importance;

    @Column(name = "mental_thread_id")
    private String mentalThreadId;

    @Column(name = "start_date_time", nullable = false)
    private LocalDateTime startDateTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_frequency", nullable = false, length = 20)
    private TaskRecurrenceFrequency recurrenceFrequency;

    @Column(name = "recurrence_end_date")
    private LocalDate recurrenceEndDate;

    @Column(name = "recurrence_interval")
    private Integer recurrenceInterval;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_unit", length = 20)
    private TaskRecurrenceUnit recurrenceUnit;

    @Column(name = "time_zone", nullable = false, length = 80)
    private String timeZone;

    @Column(name = "reminder_minutes_before")
    private Integer reminderMinutesBefore;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
