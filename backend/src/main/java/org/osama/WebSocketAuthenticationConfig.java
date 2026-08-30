package org.osama;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
public class WebSocketAuthenticationConfig implements WebSocketMessageBrokerConfigurer {
    private final ObjectProvider<JwtDecoder> jwtDecoder;

    public WebSocketAuthenticationConfig(ObjectProvider<JwtDecoder> jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authorization = accessor.getFirstNativeHeader("Authorization");
                    JwtDecoder decoder = jwtDecoder.getIfAvailable();
                    if (decoder == null || authorization == null || !authorization.startsWith("Bearer ")) {
                        throw new AuthenticationCredentialsNotFoundException(
                                "A bearer token is required for notification WebSockets");
                    }
                    Jwt jwt = decoder.decode(authorization.substring(7));
                    accessor.setUser(new UsernamePasswordAuthenticationToken(jwt.getSubject(), jwt, List.of()));
                }
                return message;
            }
        });
    }
}
