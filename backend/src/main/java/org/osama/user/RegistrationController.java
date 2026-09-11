package org.osama.user;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class RegistrationController {

    private final RegistrationService registrationService;

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody RegistrationRequest request) {
        registrationService.register(
                request.email(),
                request.firstName(),
                request.lastName(),
                request.username(),
                request.password()
        );
        return ResponseEntity.noContent().build();
    }

    public record RegistrationRequest(
            String email,
            String firstName,
            String lastName,
            String username,
            String password
    ) {}
}
