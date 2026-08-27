package org.osama.note;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteCategoryRepository extends JpaRepository<NoteCategory, String> {
    List<NoteCategory> findAllByUserIdOrderByNameAsc(String userId);
    Optional<NoteCategory> findByIdAndUserId(String id, String userId);
    Optional<NoteCategory> findByUserIdAndNormalizedName(String userId, String normalizedName);
}
