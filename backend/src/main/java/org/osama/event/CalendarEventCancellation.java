package org.osama.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@org.hibernate.annotations.SQLDelete(sql = "UPDATE calendar_event_cancellation SET soft_deleted = true WHERE cancellation_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Table(name = "calendar_event_cancellation")
public class CalendarEventCancellation {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "cancellation_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private CalendarEvent event;

    @Column(name = "event_id", insertable = false, updatable = false)
    private String eventId;

    @Column(name = "occurrence_key", nullable = false, length = 120)
    private String occurrenceKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "occurrence_status", nullable = false, length = 20)
    private CalendarEventStatus occurrenceStatus = CalendarEventStatus.CANCELLED;

    @Column(name = "deleted", nullable = false)
    private boolean deleted;

    @Column(name = "override_start_date")
    private LocalDate overrideStartDate;

    @Column(name = "override_end_date")
    private LocalDate overrideEndDate;

    @Column(name = "override_start_time")
    private Instant overrideStartTime;

    @Column(name = "override_end_time")
    private Instant overrideEndTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
