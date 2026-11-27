package org.osama.path;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.osama.path.scoring.InputDirection;
import org.osama.path.scoring.InputPeriod;
import org.osama.path.scoring.InputRule;
import org.osama.path.scoring.InputScoring;

/** One stat feeding a signal, with what "doing well" means for it. */
@Getter
@Setter
@Entity
@Table(name = "path_signal_input")
public class PathSignalInput {
    /** Use the stat's main value rather than one of its additional inputs. */
    public static final String MAIN_VALUE = "VALUE";

    @Id
    @Column(name = "input_id", nullable = false)
    private String id;

    @ManyToOne
    @JoinColumn(name = "signal_id", nullable = false)
    private PathSignal signal;

    @Column(name = "stat_definition_id", nullable = false)
    private String statDefinitionId;

    // VALUE, or the name of one of the stat's additional input types such as DURATION.
    @Column(name = "value_source", nullable = false, length = 16)
    private String valueSource;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InputDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private InputPeriod period;

    @Column(nullable = false)
    private double target;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InputScoring scoring;

    @Column(nullable = false)
    private double weight = 1;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    public InputRule rule() {
        return new InputRule(scoring, direction, target, weight);
    }
}
