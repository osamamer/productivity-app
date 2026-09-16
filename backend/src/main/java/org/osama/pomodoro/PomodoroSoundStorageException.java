package org.osama.pomodoro;

/**
 * Signals an infrastructure failure while persisting a user-uploaded sound.
 * This must not be reported as a client validation error.
 */
public class PomodoroSoundStorageException extends RuntimeException {
    public PomodoroSoundStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
