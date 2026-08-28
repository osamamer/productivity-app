package org.osama.mentalthread;

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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "mental_thread_load_entry")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentalThreadLoadEntry {

    @Id
    @Column(name = "entry_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id", nullable = false)
    private MentalThread mentalThread;

    @Column(nullable = false)
    private int load;

    @Enumerated(EnumType.STRING)
    @Column(name = "attention_state", nullable = false, length = 20)
    private AttentionState attentionState;

    @Column(length = 500)
    private String reason;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private LocalDateTime recordedAt;

    @PrePersist
    void onCreate() {
        recordedAt = recordedAt == null ? LocalDateTime.now() : recordedAt;
    }
}
