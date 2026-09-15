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
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "calendar_event_cancellation", uniqueConstraints = {
        @UniqueConstraint(
                name = "uq_app_calendar_event_cancellation_event_occurrence",
                columnNames = {"event_id", "occurrence_key"})
})
public class CalendarEventCancellation {
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
