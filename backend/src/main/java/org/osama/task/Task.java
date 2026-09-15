package org.osama.task;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import jakarta.persistence.*;
import lombok.Data;
import org.osama.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime creationDateTime;


    @Column
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime scheduledPerformDateTime;

    @Column(name = "time_zone", length = 80)
    private String timeZone = "UTC";


    @Column
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime completionDateTime;


    @Column
    private String parentId;

    @Column
    private String projectId;

    @Column
    private String tag;

    @Column
    private int importance;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "mental_thread_id")
    private String mentalThreadId;

    @Column(name = "task_series_id")
    private String taskSeriesId;

    @Column(name = "series_occurrence_at")
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime seriesOccurrenceAt;

    @Column(nullable = false)
    private boolean skipped;

    @Enumerated(EnumType.STRING)
    @Column(name = "skip_reason", length = 30)
    private TaskSkipReason skipReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Transient
    private Integer reminderMinutesBefore;

    @Transient
    private boolean statLinked;
}
