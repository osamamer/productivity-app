package org.osama.user;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Objects;

@Service
@Slf4j
public class KeycloakAccountService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.keycloak.base-url:http://localhost:7070}")
    private String keycloakBaseUrl;

    @Value("${app.keycloak.realm:productivity-app}")
    private String keycloakRealm;

    @Value("${app.keycloak.password-verification-client-id:admin-cli}")
    private String passwordVerificationClientId;

    @Value("${app.keycloak.admin.realm:master}")
    private String adminRealm;

    @Value("${app.keycloak.admin.client-id:admin-cli}")
    private String adminClientId;

    @Value("${app.keycloak.admin.username:admin}")
    private String adminUsername;

    @Value("${app.keycloak.admin.password:adminpassword}")
    private String adminPassword;

    public void changePassword(String username, String keycloakUserId, String currentPassword, String newPassword) {
        if (!isCurrentPasswordValid(username, currentPassword)) {
            throw new InvalidCurrentPasswordException("Current password is incorrect.");
        }

        String adminAccessToken = fetchAdminAccessToken();
        resetPassword(keycloakUserId, newPassword, adminAccessToken);
    }

    private boolean isCurrentPasswordValid(String username, String currentPassword) {
        try {
            postForm(tokenEndpoint(keycloakRealm), buildPasswordGrantForm(passwordVerificationClientId, username, currentPassword), false);
            return true;
        } catch (HttpStatusCodeException e) {
            HttpStatusCode statusCode = e.getStatusCode();
            String responseBody = e.getResponseBodyAsString();
            if (statusCode == HttpStatus.UNAUTHORIZED || (statusCode == HttpStatus.BAD_REQUEST && responseBody.contains("invalid_grant"))) {
                log.info("Keycloak rejected current password verification for username={}", username);
                return false;
            }

            log.error("Failed to verify current password with Keycloak: {}", responseBody, e);
            throw new PasswordUpdateFailedException("Could not verify the current password against Keycloak.", e);
        }
    }

    private String fetchAdminAccessToken() {
        try {
            Map<String, Object> response = postForm(
                    tokenEndpoint(adminRealm),
                    buildPasswordGrantForm(adminClientId, adminUsername, adminPassword),
                    true
            );
            Object accessToken = response.get("access_token");
            if (!(accessToken instanceof String token) || token.isBlank()) {
                throw new PasswordUpdateFailedException("Keycloak admin token response did not include an access token.", null);
            }
            return token;
        } catch (HttpStatusCodeException e) {
            log.error("Failed to obtain Keycloak admin token: {}", e.getResponseBodyAsString(), e);
            throw new PasswordUpdateFailedException("Could not authenticate with Keycloak admin API.", e);
        }
    }

    private void resetPassword(String keycloakUserId, String newPassword, String adminAccessToken) {
        String url = String.format(
                "%s/admin/realms/%s/users/%s/reset-password",
                keycloakBaseUrl,
                keycloakRealm,
                keycloakUserId
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(adminAccessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = Map.of(
                "type", "password",
                "temporary", false,
                "value", newPassword
        );

        try {
            restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(requestBody, headers), Void.class);
        } catch (HttpStatusCodeException e) {
            log.error("Failed to reset Keycloak password for user {}: {}", keycloakUserId, e.getResponseBodyAsString(), e);
            throw new PasswordUpdateFailedException(extractPasswordPolicyMessage(e), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postForm(String url, MultiValueMap<String, String> form, boolean expectBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(form, headers), Map.class);
        return expectBody ? Objects.requireNonNullElse(response.getBody(), Map.of()) : Map.of();
    }

    private MultiValueMap<String, String> buildPasswordGrantForm(String clientId, String username, String password) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("grant_type", "password");
        form.add("username", username);
        form.add("password", password);
        return form;
    }

    private String tokenEndpoint(String realm) {
        return String.format("%s/realms/%s/protocol/openid-connect/token", keycloakBaseUrl, realm);
    }

    private String extractPasswordPolicyMessage(HttpStatusCodeException e) {
        if (e.getStatusCode() == HttpStatus.BAD_REQUEST) {
            return "New password was rejected by Keycloak password policy.";
        }
        return "Could not update password in Keycloak.";
    }
}
