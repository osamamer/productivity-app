package org.osama.daytemplate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.osama.event.CalendarEventStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "day_template_event")
public class DayTemplateEvent {
    @Id
    @Column(name = "event_template_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private DayTemplate template;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "time_zone", nullable = false, length = 80)
    private String timeZone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CalendarEventStatus status = CalendarEventStatus.CONFIRMED;

    @Column(name = "reminder_minutes_before")
    private Integer reminderMinutesBefore;

    public void initializeId() {
        id = UUID.randomUUID().toString();
    }
}
