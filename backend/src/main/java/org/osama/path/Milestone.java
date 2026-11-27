package org.osama.path;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * The end of one project on a path. Name, progress and status come from the project; the target
 * date only places the ring on the road and has no bearing on whether it is done.
 */
@Getter
@Setter
@Entity
@Table(name = "milestone")
public class Milestone {
    @Id
    @Column(name = "milestone_id", nullable = false)
    private String id;

    @Column(name = "path_id", nullable = false)
    private String pathId;

    @Column(name = "project_id", nullable = false, unique = true)
    private String projectId;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}
