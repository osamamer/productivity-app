package org.osama;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketTestController {

    @MessageMapping("/test")
    @SendTo("/topic/test")
    public String test(String message) {
        return "Server received: " + message;
    }
}