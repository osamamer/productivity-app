package org.osama.project;

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
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.osama.user.User;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A dated step inside a project, measured by a stat. It is done when its metric reaches the target;
 * that is derived from stat entries each time, not stored.
 */
@Getter
@Setter
@Entity
@Table(name = "checkpoint")
@SQLDelete(sql = "UPDATE checkpoint SET soft_deleted = true WHERE checkpoint_id = ?")
@Where(clause = "soft_deleted = false")
public class Checkpoint {
    /** Use the stat's main value rather than one of its additional inputs. */
    public static final String MAIN_VALUE = "VALUE";

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "checkpoint_id", nullable = false)
    private String id;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "stat_definition_id", nullable = false)
    private String statDefinitionId;

    @Column(name = "value_source", nullable = false, length = 16)
    private String valueSource;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CheckpointAggregation aggregation;

    @Column(name = "count_from", nullable = false)
    private LocalDate countFrom;

    @Column(nullable = false)
    private double baseline;

    @Column(name = "target_value", nullable = false)
    private double targetValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
