package org.osama.meditation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;

@Data
@Entity
public class MeditationSession {
    @Id
    @Column(nullable = false)
    private String id;

    @Column
    private String mood;
}
