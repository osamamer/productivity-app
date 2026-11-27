package org.osama.path;

public record PathResponse(String id, String name, String color, String icon, int displayOrder, boolean paused,
                           SignalResponse signal) {
}
