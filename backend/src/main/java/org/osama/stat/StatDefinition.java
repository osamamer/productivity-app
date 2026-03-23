package org.osama.stat;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

@Data
@NoArgsConstructor
@Entity
public class StatDefinition {

    @Id
    @Column(nullable = false)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatType type;

    // Only meaningful when type == RANGE; null for NUMBER and BOOLEAN.
    @Column
    private Double minValue;

    @Column
    private Double maxValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
