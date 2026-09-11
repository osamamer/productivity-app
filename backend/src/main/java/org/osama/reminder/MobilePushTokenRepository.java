package org.osama.reminder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MobilePushTokenRepository extends JpaRepository<MobilePushToken, String> {
    List<MobilePushToken> findAllByUserId(String userId);

    long deleteByUserId(String userId);
}
