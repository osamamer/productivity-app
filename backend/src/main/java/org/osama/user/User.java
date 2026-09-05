package org.osama.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Data
@Entity
@Table(name = "app_user")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class User {

    @Id
    @Column(nullable = false, unique = true)
    private String id;

    @Column(unique = true)
    private String keycloakId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private Boolean active;

    @Builder.Default
    @Column(name = "include_unlogged_numeric_days_as_zero", nullable = false)
    private Boolean includeUnloggedNumericDaysAsZero = false;

    @Builder.Default
    @Column(name = "auto_start_pomodoro_sessions", nullable = false)
    private Boolean autoStartPomodoroSessions = true;

    @Builder.Default
    @Column(name = "checkup_notifications_enabled", nullable = false)
    private Boolean checkupNotificationsEnabled = true;

    @Builder.Default
    @Column(name = "checkup_interval_minutes", nullable = false)
    private Integer checkupIntervalMinutes = 180;

    @Builder.Default
    @Column(name = "checkup_start_time", nullable = false)
    private LocalTime checkupStartTime = LocalTime.of(9, 0);

    @Builder.Default
    @Column(name = "checkup_times_per_day", nullable = false)
    private Integer checkupTimesPerDay = 5;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime modifiedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.modifiedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        // Assigned-id fixtures are merged rather than persisted, so repair this
        // invariant here as well as in the normal insert callback.
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        this.modifiedAt = LocalDateTime.now();
    }
}
