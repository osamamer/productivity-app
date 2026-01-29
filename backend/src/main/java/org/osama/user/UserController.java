package org.osama.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@RequestBody CreateUserRequest request) {
        User user = userService.createUser(
                request.email(),
                request.firstName(),
                request.lastName(),
                request.username(),
                request.keycloakId()
        );

        // Build Location header with URI of created resource
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(user.getId())
                .toUri();

        // Return 201 Created with Location header and body
        return ResponseEntity.created(location).body(UserResponse.from(user));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String userId) {
        return userService.getUserById(userId)
                .map(UserResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<UserResponse> getUserByEmail(@PathVariable String email) {
        return userService.getUserByEmail(email)
                .map(UserResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<UserResponse> getUserByUsername(@PathVariable String username) {
        return userService.getUserByUsername(username)
                .map(UserResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<UserResponse> users = userService.getAllUsers()
                .stream()
                .map(UserResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable String userId,
            @RequestBody UpdateUserRequest request
    ) {
        User updatedUser = userService.updateUser(
                userId,
                request.email(),
                request.firstName(),
                request.lastName(),
                request.username()
        );
        // Return 200 OK with updated user
        return ResponseEntity.ok(UserResponse.from(updatedUser));
    }

    @PatchMapping("/{userId}/deactivate")
    public ResponseEntity<UserResponse> deactivateUser(@PathVariable String userId) {
        userService.deactivateUser(userId);
        // Return the updated user
        User user = userService.getUserById(userId)
                .orElseThrow(() -> new IllegalStateException("User should exist after deactivation"));
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PatchMapping("/{userId}/activate")
    public ResponseEntity<UserResponse> activateUser(@PathVariable String userId) {
        userService.activateUser(userId);
        // Return the updated user
        User user = userService.getUserById(userId)
                .orElseThrow(() -> new IllegalStateException("User should exist after activation"));
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        userService.deleteUser(userId);
        // Return 204 No Content (standard for successful DELETE)
        return ResponseEntity.noContent().build();
    }

    // DTOs
    public record CreateUserRequest(
            String email,
            String firstName,
            String lastName,
            String username,
            String keycloakId
    ) {}

    public record UpdateUserRequest(
            String email,
            String firstName,
            String lastName,
            String username
    ) {}
}