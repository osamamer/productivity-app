package org.osama.calendar;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "calendar_source")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE calendar_source SET soft_deleted = true WHERE source_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
public class CalendarSource {
    @Id
    @Column(name = "source_id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "calendar_id", nullable = false)
    private String calendarId;

    @Column(name = "source_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private Type type;

    // Subscription URLs may contain bearer secrets. Never expose or log this field.
    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "source_payload", columnDefinition = "TEXT")
    // Retain the latest feed so uploaded files can be re-expanded as the rolling window moves.
    private String sourcePayload;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    public enum Type { ICS_FILE, ICS_URL }
}
