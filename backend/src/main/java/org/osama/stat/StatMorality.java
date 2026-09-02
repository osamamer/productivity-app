package org.osama.stat;

/**
 * Describes which direction of a stat represents a desirable result.
 * A null value is supported for backwards compatibility and means NEUTRAL.
 */
public enum StatMorality {
    GOOD,
    BAD,
    NEUTRAL
}
