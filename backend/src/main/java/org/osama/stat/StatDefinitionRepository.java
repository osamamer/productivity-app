package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StatDefinitionRepository extends JpaRepository<StatDefinition, String> {

    List<StatDefinition> findAllByUserId(String userId);

    Optional<StatDefinition> findByIdAndUserId(String id, String userId);
}
