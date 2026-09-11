package org.osama.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[A-Za-z0-9._-]{3,50}$");

    private final KeycloakAccountService keycloakAccountService;

    public void register(String email, String firstName, String lastName, String username, String password) {
        String normalizedEmail = requireText(email, "Email").toLowerCase();
        String normalizedFirstName = requireText(firstName, "First name");
        String normalizedLastName = requireText(lastName, "Last name");
        String normalizedUsername = requireText(username, "Username");

        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new IllegalArgumentException("Enter a valid email address.");
        }
        if (!USERNAME_PATTERN.matcher(normalizedUsername).matches()) {
            throw new IllegalArgumentException("Username must be 3–50 characters using letters, numbers, dots, dashes, or underscores.");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }

        keycloakAccountService.registerUser(
                normalizedEmail,
                normalizedFirstName,
                normalizedLastName,
                normalizedUsername,
                password
        );
    }

    private String requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " is required.");
        }
        return value.trim();
    }
}
