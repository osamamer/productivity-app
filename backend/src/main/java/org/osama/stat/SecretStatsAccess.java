package org.osama.stat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.osama.user.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "secret_stats_access")
public class SecretStatsAccess {

    @Id
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    protected SecretStatsAccess() {
    }

    public SecretStatsAccess(String tokenHash, User user, LocalDateTime expiresAt) {
        this.tokenHash = tokenHash;
        this.user = user;
        this.expiresAt = expiresAt;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
}
