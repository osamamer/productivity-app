package org.osama.path;

public record PathViewResponse(PathSort sort, PathShape shape, PathEdges edges) {
    static PathViewResponse from(PathViewPreference preference) {
        return new PathViewResponse(preference.getSort(), preference.getShape(), preference.getEdges());
    }

    static PathViewResponse defaults() {
        return from(new PathViewPreference());
    }
}
