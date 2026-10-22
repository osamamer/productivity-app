package org.osama.calendar;

import org.junit.jupiter.api.Test;

import java.net.InetAddress;

import static org.junit.jupiter.api.Assertions.*;

class IcsFeedClientTest {
    @Test
    void rejectsPrivateAndReservedDestinationsBeforeConnecting() throws Exception {
        assertFalse(IcsFeedClient.isPublicAddress(InetAddress.getByName("127.0.0.1")));
        assertFalse(IcsFeedClient.isPublicAddress(InetAddress.getByName("10.0.0.1")));
        assertFalse(IcsFeedClient.isPublicAddress(InetAddress.getByName("169.254.169.254")));
        assertFalse(IcsFeedClient.isPublicAddress(InetAddress.getByName("100.100.100.100")));
        assertFalse(IcsFeedClient.isPublicAddress(InetAddress.getByName("fc00::1")));
        assertTrue(IcsFeedClient.isPublicAddress(InetAddress.getByName("8.8.8.8")));
    }
}
