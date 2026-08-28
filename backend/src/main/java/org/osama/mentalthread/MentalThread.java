package org.osama.mentalthread;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.osama.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "mental_thread")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentalThread {

    @Id
    @Column(name = "thread_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentalThreadStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "attention_state", nullable = false, length = 20)
    private AttentionState attentionState;

    @Column(name = "desired_resolution", columnDefinition = "TEXT")
    private String desiredResolution;

    @Enumerated(EnumType.STRING)
    @Column(name = "closure_type", length = 20)
    private ClosureType closureType;

    @Column(name = "resolution_summary", columnDefinition = "TEXT")
    private String resolutionSummary;

    @Column(name = "opened_at", nullable = false, updatable = false)
    private LocalDateTime openedAt;

    @Column(name = "target_close_date")
    private LocalDate targetCloseDate;

    @Column(name = "hard_deadline_date")
    private LocalDate hardDeadlineDate;

    @Column(name = "next_review_date")
    private LocalDate nextReviewDate;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "current_mental_load", nullable = false)
    private int currentMentalLoad;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @PrePersist
    void onCreate() {
        LocalDateTime timestamp = LocalDateTime.now();
        openedAt = openedAt == null ? timestamp : openedAt;
        createdAt = timestamp;
        updatedAt = timestamp;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
