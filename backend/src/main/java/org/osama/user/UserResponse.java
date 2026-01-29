package org.osama.user;

import java.time.LocalDateTime;

public record UserResponse(
        String id,
        String email,
        String firstName,
        String lastName,
        String username,
        Boolean active,
        LocalDateTime createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getUsername(),
                user.getActive(),
                user.getCreatedAt()
        );
    }
}