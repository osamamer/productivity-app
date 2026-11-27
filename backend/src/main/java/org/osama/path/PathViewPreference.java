package org.osama.path;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** The Paths page switches, one row per user. */
@Getter
@Setter
@Entity
@Table(name = "path_view_preference")
public class PathViewPreference {
    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PathSort sort = PathSort.ATTENTION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PathShape shape = PathShape.CURVED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PathEdges edges = PathEdges.FOLLOW_WEEKS;
}
