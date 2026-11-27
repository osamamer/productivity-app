package org.osama.path;

/** Any of the Paths page switches; null ones keep their value. */
public record PathViewRequest(PathSort sort, PathShape shape, PathEdges edges) {
}
