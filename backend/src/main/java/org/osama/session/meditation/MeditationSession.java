package org.osama.session.meditation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.osama.session.Session;

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

}
