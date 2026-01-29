package org.osama.session.meditation;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.osama.session.Session;
import org.osama.user.User;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
public class MeditationSession extends Session {
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
}
