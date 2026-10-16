package org.osama.session.meditation;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.osama.session.Session;
import org.osama.user.User;

import java.time.OffsetDateTime;
import java.time.ZoneId;

import static org.osama.constants.MeditationConstants.MAX_SESSION_SECONDS;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@org.hibernate.annotations.SQLDelete(sql = "UPDATE meditation_session SET soft_deleted = true WHERE id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
public class MeditationSession extends Session {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(nullable = false)
    private String id;

    @Column
    private int moodBefore;

    @Column
    private int moodAfter;

    @Column
    private int numIntervalBells;

    @Column
    private int intendedLength;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Transient
    @JsonProperty("expiresAt")
    public OffsetDateTime getExpiresAt() {
        return startTime == null ? null
                : startTime.plusSeconds(MAX_SESSION_SECONDS).atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
