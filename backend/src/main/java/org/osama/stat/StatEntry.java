package org.osama.stat;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Builder
@AllArgsConstructor
// Unique constraint: one entry per user per stat per day.
@Table(uniqueConstraints = {
        @UniqueConstraint(columnNames = {"stat_definition_id", "user_id", "date"})
})
public class StatEntry {

    @Id
    @Column(nullable = false)
    private String id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stat_definition_id", nullable = false)
    private StatDefinition statDefinition;

    @Column(name = "stat_definition_id", insertable = false, updatable = false)
    private String statDefinitionId;

    @Column(nullable = false)
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    private LocalDate date;

    // All three stat types are stored as double:
    //   NUMBER  -> the number itself
    //   BOOLEAN -> 1.0 (true) or 0.0 (false)
    //   RANGE   -> the value, validated against StatDefinition.minValue / maxValue
    @Column(name = "stat_value", nullable = false)
    private double value;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
