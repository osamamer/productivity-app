package org.osama.reminder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MobilePushTokenRepository extends JpaRepository<MobilePushToken, String> {
    List<MobilePushToken> findAllByUserId(String userId);

    Optional<MobilePushToken> findByToken(String token);
}
