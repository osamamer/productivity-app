package org.osama.desktop;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The desktop app's local mode: the backend runs its own PostgreSQL, applies the regular
 * migrations, serves the bundled web app, and accepts only tokens signed with the secret the
 * desktop shell generated for this launch.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("desktop")
class DesktopLocalModeTest {

    private static final byte[] LAUNCH_SECRET = randomSecret();
    private static final Path DATA_DIRECTORY = temporaryDirectory("desktop-data");
    private static final Path FRONTEND_DIRECTORY = createFrontend();

    @Autowired
    private TestRestTemplate rest;

    @DynamicPropertySource
    static void desktopProperties(DynamicPropertyRegistry registry) {
        registry.add("app.desktop.data-directory", DATA_DIRECTORY::toString);
        registry.add("app.desktop.frontend-directory", FRONTEND_DIRECTORY::toString);
        registry.add("app.desktop.auth-secret", () -> Base64.getEncoder().encodeToString(LAUNCH_SECRET));
    }

    @Test
    void apiRejectsRequestsWithoutAToken() {
        ResponseEntity<String> response = rest.getForEntity("/api/v1/tasks", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void apiAcceptsATokenSignedWithTheLaunchSecret() {
        ResponseEntity<String> response = getWithToken("/api/v1/tasks", signToken(LAUNCH_SECRET));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void apiRejectsATokenFromAnotherLaunch() {
        ResponseEntity<String> response = getWithToken("/api/v1/tasks", signToken(randomSecret()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void theWebAppIsServedWithoutATokenAtTheRootAndOnClientSideRoutes() {
        assertThat(rest.getForEntity("/", String.class).getBody()).contains("bundled web app");
        assertThat(rest.getForEntity("/tasks/some-task", String.class).getBody()).contains("bundled web app");
    }

    @Test
    void unknownApiPathsAreNotAnsweredWithTheWebApp() {
        ResponseEntity<String> response = getWithToken("/api/v1/does-not-exist", signToken(LAUNCH_SECRET));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private ResponseEntity<String> getWithToken(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private static String signToken(byte[] secret) {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("local-user")
                .claim("preferred_username", "local")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(1, ChronoUnit.HOURS)))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(new MACSigner(secret));
        } catch (JOSEException e) {
            throw new IllegalStateException("Could not sign the test token", e);
        }
        return jwt.serialize();
    }

    private static byte[] randomSecret() {
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        return secret;
    }

    private static Path temporaryDirectory(String prefix) {
        try {
            return Files.createTempDirectory(prefix);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Path createFrontend() {
        Path directory = temporaryDirectory("desktop-frontend");
        try {
            Files.writeString(directory.resolve("index.html"), "<html>bundled web app</html>");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return directory;
    }
}
