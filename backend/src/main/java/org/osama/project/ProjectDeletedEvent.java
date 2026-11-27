package org.osama.project;

/** Published inside the deleting transaction, so things that hang off a project (milestones) go with it. */
public record ProjectDeletedEvent(String projectId, String userId) {
}
