package org.osama.session.meditation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.osama.session.Session;

@Data
@Entity
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
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
