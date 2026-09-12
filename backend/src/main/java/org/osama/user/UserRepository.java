package org.osama.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findUserById(String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.id = :userId")
    Optional<User> findUserByIdForUpdate(@Param("userId") String userId);

    Optional<User> findUserByKeycloakId(String keycloakId);
    Optional<User> findUserByEmail(String email);
    Optional<User> findUserByUsername(String username);

    List<User> findAllByActiveTrue();

}
