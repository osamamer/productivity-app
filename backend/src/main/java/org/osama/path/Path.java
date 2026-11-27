package org.osama.path;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.osama.user.User;

import java.time.Instant;

/** A long-running area of a life, such as Writer or Body. Every path has exactly one signal. */
@Getter
@Setter
@Entity
@Table(name = "life_path")
@SQLDelete(sql = "UPDATE life_path SET soft_deleted = true WHERE path_id = ?")
@Where(clause = "soft_deleted = false")
public class Path {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "path_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 16)
    private String color;

    @Column(nullable = false, length = 32)
    private String icon;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(nullable = false)
    private boolean paused;

    @OneToOne(mappedBy = "path", cascade = CascadeType.ALL, orphanRemoval = true)
    private PathSignal signal;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
