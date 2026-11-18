package org.osama.activity;

public record ActivityResponse(String id, String name, String color, int displayOrder) {
    static ActivityResponse from(Activity activity) {
        return new ActivityResponse(activity.getId(), activity.getName(), activity.getColor(), activity.getDisplayOrder());
    }
}
