package org.osama.stat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@org.hibernate.annotations.SQLDelete(sql = "UPDATE stat_focus_task_link SET soft_deleted = true WHERE id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Table(name = "stat_focus_task_link")
public class StatFocusTaskLink {

    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(nullable = false)
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stat_definition_id", nullable = false)
    private StatDefinition statDefinition;

    @Column(name = "stat_definition_id", insertable = false, updatable = false)
    private String statDefinitionId;

    @Column(name = "task_name", nullable = false, length = 255)
    private String taskName;
}
