package org.osama.calendar;

import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClients;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;

@Component
public class IcsFeedClient {
    public static final int MAX_BYTES = 2 * 1024 * 1024;

    public String fetch(String url) {
        URI uri = validateUrl(url);
        var config = RequestConfig.custom().setConnectTimeout(5000).setSocketTimeout(10000)
                .setConnectionRequestTimeout(5000).build();
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(25);
        try (var client = HttpClients.custom().disableRedirectHandling().setDefaultRequestConfig(config)
                .setDnsResolver(host -> {
                    InetAddress[] addresses = InetAddress.getAllByName(host);
                    for (InetAddress address : addresses) {
                        if (!isPublicAddress(address)) {
                            throw new UnknownHostException("Private network calendar URLs are not allowed.");
                        }
                    }
                    return addresses;
                }).build()) {
            for (int redirects = 0; redirects <= 3; redirects++) {
                try (var response = client.execute(new HttpGet(uri))) {
                    int status = response.getStatusLine().getStatusCode();
                    if (status >= 300 && status < 400 && redirects < 3
                            && response.getFirstHeader("Location") != null) {
                        uri = validateRedirect(uri, response.getFirstHeader("Location").getValue());
                        continue;
                    }
                    return readResponse(response, deadline);
                }
            }
            throw new IllegalArgumentException("Calendar feed redirected too many times.");
        } catch (IOException exception) {
            // Do not put the URL or the underlying request exception in logs: feed URLs can be bearer secrets.
            throw new IllegalArgumentException("Calendar feed could not be downloaded.");
        }
    }

    private String readResponse(org.apache.http.client.methods.CloseableHttpResponse response, long deadline) throws IOException {
        if (response.getStatusLine().getStatusCode() != 200 || response.getEntity() == null) {
            throw new IllegalArgumentException("Calendar feed could not be downloaded.");
        }
        try (var stream = response.getEntity().getContent()) {
            var content = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = stream.read(buffer)) != -1) {
                if (System.nanoTime() > deadline) throw new IllegalArgumentException("Calendar feed took too long to download.");
                if (content.size() + count > MAX_BYTES) throw new IllegalArgumentException("Calendar feed is too large.");
                content.write(buffer, 0, count);
            }
            return content.toString(StandardCharsets.UTF_8);
        }
    }

    private URI validateUrl(String url) {
        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getPort() != -1) {
                throw new IllegalArgumentException();
            }
            return uri;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Enter a valid HTTPS calendar URL.");
        }
    }

    private URI validateRedirect(URI current, String location) {
        try {
            return validateUrl(current.resolve(location).toString());
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Calendar feed redirected to an invalid address.");
        }
    }

    static boolean isPublicAddress(InetAddress address) {
        byte[] bytes = address.getAddress();
        if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                || address.isSiteLocalAddress() || address.isLinkLocalAddress()
                || address.isMulticastAddress()) return false;
        if (bytes.length == 16) return (bytes[0] & 0xe0) == 0x20;
        int first = bytes[0] & 0xff;
        int second = bytes[1] & 0xff;
        int third = bytes[2] & 0xff;
        return first >= 1 && first < 224
                && !(first == 100 && second >= 64 && second <= 127)
                && !(first == 192 && second == 0 && third == 0)
                && !(first == 192 && second == 0 && third == 2)
                && !(first == 198 && (second == 18 || second == 19))
                && !(first == 198 && second == 51 && third == 100)
                && !(first == 203 && second == 0 && third == 113);
    }
}
