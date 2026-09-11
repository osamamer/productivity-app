package org.osama.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class RegistrationServiceTest {

    private KeycloakAccountService keycloakAccountService;
    private RegistrationService registrationService;

    @BeforeEach
    void setUp() {
        keycloakAccountService = mock(KeycloakAccountService.class);
        registrationService = new RegistrationService(keycloakAccountService);
    }

    @Test
    void normalizesAccountDetailsBeforeCreatingIdentity() {
        registrationService.register(
                "  Person@Example.COM ",
                "  First ",
                " Last  ",
                " person.name ",
                "password123"
        );

        verify(keycloakAccountService).registerUser(
                "person@example.com",
                "First",
                "Last",
                "person.name",
                "password123"
        );
    }

    @Test
    void rejectsShortPasswordsBeforeCallingIdentityProvider() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                registrationService.register("person@example.com", "First", "Last", "person", "short")
        );

        assertEquals("Password must be at least 8 characters.", exception.getMessage());
        verifyNoInteractions(keycloakAccountService);
    }

    @Test
    void rejectsUnsafeUsernameCharactersBeforeCallingIdentityProvider() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                registrationService.register("person@example.com", "First", "Last", "person name", "password123")
        );

        assertEquals(
                "Username must be 3–50 characters using letters, numbers, dots, dashes, or underscores.",
                exception.getMessage()
        );
        verifyNoInteractions(keycloakAccountService);
    }
}
