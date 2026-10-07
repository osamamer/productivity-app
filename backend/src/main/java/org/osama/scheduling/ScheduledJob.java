package org.osama.scheduling;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import jakarta.persistence.*;
import lombok.Data;
import org.osama.user.User;

import java.time.LocalDateTime;

@org.hibernate.annotations.SQLDelete(sql = "UPDATE scheduled_job SET soft_deleted = true WHERE job_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Data
public class ScheduledJob {

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(nullable = false)
    private String jobId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private JobType jobType;

    @Column
    private String associatedTaskId;

    @Column(nullable = false)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime dueDate;

    @Column(nullable = false)
    private boolean scheduled;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
