package org.osama.activity;

/** Create or update an activity. On update, a null field is left as it is. */
public record ActivityRequest(String name, String color, Integer displayOrder) {
}
