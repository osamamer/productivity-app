package org.osama.note;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NoteRepository extends JpaRepository<Note, String> {
    List<Note> findAllByUserIdOrderByPinnedDescUpdatedAtDesc(String userId);
    Optional<Note> findByIdAndUserId(String id, String userId);

    @Modifying
    @Query("update Note note set note.category = null where note.category.id = :categoryId and note.userId = :userId")
    int clearCategoryAssignments(@Param("categoryId") String categoryId, @Param("userId") String userId);

    @Query("""
            select note.title
            from Note note
            where note.userId = :userId
              and note.title like concat(:prefix, '%')
            """)
    List<String> findTitlesStartingWith(
            @Param("userId") String userId,
            @Param("prefix") String prefix
    );
}
