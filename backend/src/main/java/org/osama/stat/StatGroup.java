package org.osama.stat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.CascadeType;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.osama.user.User;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@org.hibernate.annotations.SQLDelete(sql = "UPDATE stat_group SET soft_deleted = true WHERE group_id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
@Table(name = "stat_group")
public class StatGroup {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    @Column(name = "group_id", nullable = false)
    private String groupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<StatGroupDefinition> definitionMemberships = new LinkedHashSet<>();

    public Set<StatDefinition> getDefinitions() {
        return definitionMemberships.stream()
                .map(StatGroupDefinition::getDefinition)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void replaceDefinitions(Collection<StatDefinition> definitions) {
        var requestedDefinitions = definitions.stream()
                .collect(Collectors.toMap(StatDefinition::getId, definition -> definition));
        definitionMemberships.removeIf(membership ->
                !requestedDefinitions.containsKey(membership.getDefinition().getId()));
        Set<String> currentIds = definitionMemberships.stream()
                .map(membership -> membership.getDefinition().getId())
                .collect(Collectors.toSet());
        requestedDefinitions.values().stream()
                .filter(definition -> !currentIds.contains(definition.getId()))
                .forEach(this::addDefinition);
    }

    public void addDefinition(StatDefinition definition) {
        boolean alreadyLinked = definitionMemberships.stream()
                .anyMatch(membership -> membership.getDefinition().getId().equals(definition.getId()));
        if (alreadyLinked) return;
        StatGroupDefinition membership = new StatGroupDefinition();
        membership.setGroup(this);
        membership.setDefinition(definition);
        definitionMemberships.add(membership);
    }

    public boolean removeDefinitions(Collection<String> definitionIds) {
        return definitionMemberships.removeIf(membership ->
                definitionIds.contains(membership.getDefinition().getId()));
    }

    public void clearDefinitions() {
        definitionMemberships.clear();
    }

    public int definitionCount() {
        return definitionMemberships.size();
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
