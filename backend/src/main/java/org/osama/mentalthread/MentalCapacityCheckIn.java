package org.osama.mentalthread;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.osama.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

@org.hibernate.annotations.SQLDelete(sql = "UPDATE mental_capacity_check_in SET soft_deleted = true WHERE check_in_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Table(name = "mental_capacity_check_in")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentalCapacityCheckIn {

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "check_in_id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(name = "check_in_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime timestamp = LocalDateTime.now();
        createdAt = timestamp;
        updatedAt = timestamp;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
