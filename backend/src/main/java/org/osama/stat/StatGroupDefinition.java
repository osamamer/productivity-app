package org.osama.stat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "stat_group_definition")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE stat_group_definition SET soft_deleted = true WHERE membership_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Getter
@Setter
@NoArgsConstructor
public class StatGroupDefinition {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "membership_id", nullable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private StatGroup group;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stat_definition_id", nullable = false)
    private StatDefinition definition;
}
