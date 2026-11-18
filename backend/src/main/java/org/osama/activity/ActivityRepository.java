package org.osama.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<Activity, String> {
    List<Activity> findAllByUserIdOrderByDisplayOrderAscNameAsc(String userId);

    Optional<Activity> findByIdAndUserId(String id, String userId);
}
