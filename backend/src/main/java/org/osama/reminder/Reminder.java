package org.osama.reminder;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.event.CalendarEvent;
import org.osama.user.User;

import java.time.Instant;

@Data
@NoArgsConstructor
@Entity
public class Reminder {
    @Id
    @Column(nullable = false)
    private String reminderId;

    @Column
    private String taskId;

    @Column(nullable = false)
    private Instant dateTime;

    @Column(name = "event_occurrence_start")
    private Instant eventOccurrenceStart;

    @Column(nullable = false)
    private int repeat;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false)
    private NotificationType notificationType = NotificationType.CALENDAR_EVENT;

    @Column(length = 200)
    private String title;

    @Column(length = 500)
    private String body;

    @Column(name = "target_url", length = 255)
    private String targetUrl;

    @Column(name = "minutes_before", nullable = false)
    private int minutesBefore;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private CalendarEvent event;

    @Column(name = "event_id", insertable = false, updatable = false)
    private String eventId;

    @Column(name = "dispatched_at")
    private Instant dispatchedAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
