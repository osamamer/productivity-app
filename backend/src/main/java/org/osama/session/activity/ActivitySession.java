package org.osama.session.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.osama.user.User;

import java.time.Duration;
import java.time.Instant;

/**
 * Time actually spent on an activity, started from the Now page: a plain timer, not a pomodoro.
 * Unlike {@code TaskSession} it stores instants, so it reads the same in every time zone.
 *
 * Limitation: pauses are kept as one running total, not as separate spans, so a timeline draws
 * a paused session as one block from start to end.
 */
@Getter
@Setter
@Entity
@Table(name = "activity_session")
@SQLDelete(sql = "UPDATE activity_session SET soft_deleted = true WHERE activity_session_id = ?")
@Where(clause = "soft_deleted = false")
public class ActivitySession {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "activity_session_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    // Null for a timer that was not started for any activity.
    @Column(name = "activity_id")
    private String activityId;

    // The planned chunk this timer was started from, if any.
    @Column(name = "event_id")
    private String eventId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    // Null while the timer is running or paused.
    @Column(name = "ended_at")
    private Instant endedAt;

    // Set while paused.
    @Column(name = "paused_at")
    private Instant pausedAt;

    @Column(name = "paused_millis", nullable = false)
    private long pausedMillis;

    // When a countdown is meant to finish; null for an open-ended timer.
    @Column(name = "target_end_at")
    private Instant targetEndAt;

    public boolean isActive() {
        return endedAt == null;
    }

    public boolean isPaused() {
        return isActive() && pausedAt != null;
    }

    /** Time spent so far, without pauses. */
    public Duration elapsed(Instant now) {
        Instant until = endedAt != null ? endedAt : pausedAt != null ? pausedAt : now;
        return Duration.between(startedAt, until).minusMillis(pausedMillis);
    }
}
