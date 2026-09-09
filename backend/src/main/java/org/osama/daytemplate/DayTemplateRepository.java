package org.osama.daytemplate;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DayTemplateRepository extends JpaRepository<DayTemplate, String> {
    List<DayTemplate> findAllByUserIdOrderByNameAsc(String userId);

    Optional<DayTemplate> findByIdAndUserId(String id, String userId);
}
