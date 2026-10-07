package org.osama.reminder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WebPushSubscriptionRepository extends JpaRepository<WebPushSubscription, String> {
    Optional<WebPushSubscription> findByEndpoint(String endpoint);

    Optional<WebPushSubscription> findByEndpointAndUserId(String endpoint, String userId);

    @Query("select subscription.userId from WebPushSubscription subscription where subscription.endpoint = :endpoint")
    Optional<String> findUserIdByEndpoint(@Param("endpoint") String endpoint);

    List<WebPushSubscription> findAllByUserId(String userId);
}
