package org.osama.exceptions;

import lombok.extern.slf4j.Slf4j;
import org.osama.user.InvalidCurrentPasswordException;
import org.osama.user.PasswordUpdateFailedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ParentTaskNotFoundException.class)
    public ResponseEntity<String> handleParentTaskNotFound(ParentTaskNotFoundException ex) {
        log.warn("Request rejected because the parent task was not found: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<String> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("Request rejected because a resource was not found: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Request rejected due to invalid input: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(InvalidCurrentPasswordException.class)
    public ResponseEntity<String> handleInvalidCurrentPassword(InvalidCurrentPasswordException ex) {
        log.warn("Password change rejected because the current password was invalid", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(PasswordUpdateFailedException.class)
    public ResponseEntity<String> handlePasswordUpdateFailed(PasswordUpdateFailedException ex) {
        log.error("Password change failed while communicating with Keycloak", ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ex.getMessage());
    }
}
