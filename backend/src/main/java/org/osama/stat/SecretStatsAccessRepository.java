package org.osama.stat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface SecretStatsAccessRepository extends JpaRepository<SecretStatsAccess, String> {

    @Modifying
    @Query("delete from SecretStatsAccess access where access.tokenHash = :tokenHash "
            + "and access.user.id = :userId")
    void deleteAccess(@Param("tokenHash") String tokenHash, @Param("userId") String userId);

    @Modifying
    @Query("delete from SecretStatsAccess access where access.expiresAt <= :now")
    void deleteExpired(@Param("now") LocalDateTime now);

    @Query("select count(access) > 0 from SecretStatsAccess access "
            + "where access.tokenHash = :tokenHash and access.user.id = :userId and access.expiresAt > :now")
    boolean existsValidAccess(@Param("tokenHash") String tokenHash,
                              @Param("userId") String userId,
                              @Param("now") LocalDateTime now);
}
