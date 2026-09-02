package org.osama.stat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

@Data
@NoArgsConstructor
@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    // Null is treated as NEUTRAL so existing definitions remain unchanged.
    @Enumerated(EnumType.STRING)
    @Column
    private StatMorality morality;

    // Only meaningful when type == RANGE; null for NUMBER and BOOLEAN.
    @Column
    private Double minValue;

    @Column
    private Double maxValue;

    // Only meaningful for GOOD/BAD NUMBER and RANGE stats.
    @Column(name = "good_threshold")
    private Double goodThreshold;

    @Column(name = "system_key")
    private String systemKey;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
