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

    @Column(nullable = false)
    private int repeat;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
