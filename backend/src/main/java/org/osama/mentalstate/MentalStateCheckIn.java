package org.osama.mentalstate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.osama.user.User;

import java.time.Instant;

@Entity
@Table(name = "mental_state_check_in")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentalStateCheckIn {

    @Id
    @Column(name = "check_in_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    @Column(nullable = false)
    private int energy;

    @Column(nullable = false)
    private int activation;

    @Column(name = "stimulation_hunger", nullable = false)
    private int stimulationHunger;

    @Column(nullable = false)
    private int clarity;

    @Column(nullable = false)
    private int valence;

    @Column(name = "emotional_load", nullable = false)
    private int emotionalLoad;
}
