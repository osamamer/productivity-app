package org.osama.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findUserById(String userId);
    Optional<User> findUserByKeycloakId(String keycloakId);
    Optional<User> findUserByEmail(String email);
    Optional<User> findUserByUsername(String username);

}
