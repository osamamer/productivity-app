package org.osama.desktop;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Serves the bundled web app from the desktop installation. Unknown non-API paths fall back to
 * {@code index.html} so client-side routes survive a reload. Controllers are matched before
 * this handler, so API endpoints are unaffected.
 */
@Configuration
@Profile("desktop")
public class DesktopFrontendConfig implements WebMvcConfigurer {

    private final String frontendLocation;

    public DesktopFrontendConfig(@Value("${app.desktop.frontend-directory}") Path frontendDirectory) {
        this.frontendLocation = frontendDirectory.toAbsolutePath().toUri().toString();
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // The resource handler never sees an empty path, so the root needs an explicit forward.
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(frontendLocation)
                .resourceChain(true)
                .addResolver(new SinglePageAppResolver());
    }

    private static final class SinglePageAppResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (isFile(requested)) return requested;
            if (resourcePath.startsWith("api/") || resourcePath.startsWith("ws")) return null;
            return location.createRelative("index.html");
        }

        private static boolean isFile(Resource resource) throws IOException {
            return resource.exists() && resource.isFile() && resource.getFile().isFile();
        }
    }
}
