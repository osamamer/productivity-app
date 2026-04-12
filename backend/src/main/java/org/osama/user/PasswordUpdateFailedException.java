package org.osama.user;

public class PasswordUpdateFailedException extends RuntimeException {

    public PasswordUpdateFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
