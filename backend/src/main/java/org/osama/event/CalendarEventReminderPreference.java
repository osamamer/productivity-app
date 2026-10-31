package org.osama.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "calendar_event_reminder_preference")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE calendar_event_reminder_preference SET soft_deleted = true WHERE preference_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
public class CalendarEventReminderPreference {
    @Id
    @Column(name = "preference_id", nullable = false)
    private String id;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    @Column(name = "series_key", nullable = false, length = 36)
    private String seriesKey;

    @Column(name = "external_key", length = 36)
    private String externalKey;

    @Column(name = "minutes_before")
    private Integer minutesBefore;

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;
}
