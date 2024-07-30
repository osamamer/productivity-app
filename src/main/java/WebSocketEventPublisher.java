import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Slf4j
@Component
public class WebSocketEventPublisher {
    private final SimpMessagingTemplate simpMessagingTemplate;
    WebSocketEventPublisher(SimpMessagingTemplate simpMessagingTemplate) {

        this.simpMessagingTemplate = simpMessagingTemplate;
    }


    @Scheduled(fixedRate = 5000)
    public void publishEvent() {
        log.info("Sending payload!");
        simpMessagingTemplate.convertAndSend("/topic/event", "An event occurred!");
    }
}
