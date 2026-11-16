package org.osama.desktop;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

/**
 * Local-mode authentication without Keycloak. The desktop shell generates a random secret on
 * every launch, passes it to this backend, and signs a token for the single local user with it.
 * The regular resource-server chain then validates that token, so controllers, WebSockets and
 * {@code CurrentUserService} work exactly as in cloud mode. Other programs on the machine
 * cannot call the API because they never see the secret.
 */
@Configuration
@Profile("desktop")
public class DesktopSecurityConfig {

    private static final int MINIMUM_SECRET_BYTES = 32;

    @Bean
    JwtDecoder jwtDecoder(@Value("${app.desktop.auth-secret}") String encodedSecret) {
        byte[] secret = Base64.getDecoder().decode(encodedSecret);
        if (secret.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException("The desktop auth secret must be at least 32 bytes");
        }
        return NimbusJwtDecoder.withSecretKey(new SecretKeySpec(secret, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    /** The bundled web app's static files are public; everything under the API stays protected. */
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    SecurityFilterChain desktopFrontendFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher(DesktopSecurityConfig::isFrontendRequest)
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    static boolean isFrontendRequest(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith("/api/") && !path.startsWith("/ws") && !path.startsWith("/actuator");
    }
}
