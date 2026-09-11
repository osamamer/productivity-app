package org.osama.reminder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

import java.time.Instant;

@Data
@NoArgsConstructor
@Entity
@Table(name = "mobile_push_token", indexes = {
        @Index(name = "idx_app_mobile_push_token_user", columnList = "user_id")
})
public class MobilePushToken {
    @Id
    @Column(nullable = false, length = 512)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "modified_at")
    private Instant modifiedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        modifiedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        modifiedAt = Instant.now();
    }
}
