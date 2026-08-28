package org.osama.stat;

import lombok.RequiredArgsConstructor;
import org.osama.session.events.MeditationSessionEndedEvent;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MeditationSessionStatListener {

    private final UserRepository userRepository;
    private final SystemStatProvisioningService provisioningService;
    private final StatService statService;

    @EventListener
    @Transactional
    public void handleMeditationSessionEnded(MeditationSessionEndedEvent event) {
        User user = userRepository.findUserById(event.getUserId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "User not found: " + event.getUserId()));
        provisioningService.createMissingSystemStatsFor(user);

        // Sessions spanning midnight are credited to the day on which they end.
        statService.recordCompletedMeditation(
                event.getTimestamp().toLocalDate(), event.getTotalDuration(), event.getUserId());
    }
}
