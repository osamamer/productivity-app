package org.osama.path;

/** Create or update a path. On update a null field is left as it is, and the signal is changed separately. */
public record PathRequest(String name, String color, String icon, Boolean paused, Integer displayOrder,
                          SignalRequest signal) {
}
