package org.osama.path;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PathRepository extends JpaRepository<Path, String> {
    List<Path> findAllByUserIdOrderByDisplayOrderAscNameAsc(String userId);

    Optional<Path> findByIdAndUserId(String id, String userId);

    long countByUserId(String userId);
}
