package org.osama.stat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "stat_focus_task_link", uniqueConstraints = @UniqueConstraint(
        name = "uk_app_stat_focus_task_link_definition_name",
        columnNames = {"stat_definition_id", "task_name"}
))
public class StatFocusTaskLink {

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
