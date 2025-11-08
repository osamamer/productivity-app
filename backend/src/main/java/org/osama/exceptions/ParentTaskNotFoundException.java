package org.osama.exceptions;

public class ParentTaskNotFoundException extends RuntimeException {
    public ParentTaskNotFoundException(String parentId) {
        super("No task exists with the specified parent task ID: " + parentId);
    }
}
