package org.osama.path;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.osama.path.scoring.SignalCombine;

import java.util.ArrayList;
import java.util.List;

/** Turns a path's inputs into one strength per week. */
@Getter
@Setter
@Entity
@Table(name = "path_signal")
public class PathSignal {
    @Id
    @Column(name = "signal_id", nullable = false)
    private String id;

    @OneToOne
    @JoinColumn(name = "path_id", nullable = false, unique = true)
    private Path path;

    @Enumerated(EnumType.STRING)
    @Column(name = "combine_method", nullable = false, length = 16)
    private SignalCombine combineMethod;

    @OneToMany(mappedBy = "signal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<PathSignalInput> inputs = new ArrayList<>();
}
