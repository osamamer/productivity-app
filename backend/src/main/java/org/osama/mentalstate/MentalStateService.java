package org.osama.mentalstate;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class MentalStateService {

    private static final int MAX_HISTORY_LIMIT = 100;

    private final MentalStateCheckInRepository checkInRepository;
    private final MentalStateAdviceService adviceService;
    private final UserRepository userRepository;

    public MentalStateService(MentalStateCheckInRepository checkInRepository,
                              MentalStateAdviceService adviceService,
                              UserRepository userRepository) {
        this.checkInRepository = checkInRepository;
        this.adviceService = adviceService;
        this.userRepository = userRepository;
    }

    @Transactional
    public MentalStateCheckInResponse checkIn(CreateMentalStateCheckInRequest request, String userId) {
        validate(request);
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));

        MentalStateCheckIn checkIn = MentalStateCheckIn.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .recordedAt(Instant.now())
                .energy(request.energy())
                .activation(request.activation())
                .stimulationHunger(request.stimulationHunger())
                .clarity(request.clarity())
                .valence(request.valence())
                .emotionalLoad(request.emotionalLoad())
                .build();
        MentalStateCheckIn saved = checkInRepository.save(checkIn);
        log.info("Mental state check-in recorded: userId={} checkInId={} energy={} activation={} stimulationHunger={} clarity={} valence={} emotionalLoad={}",
                userId, saved.getId(), saved.getEnergy(), saved.getActivation(),
                saved.getStimulationHunger(), saved.getClarity(), saved.getValence(), saved.getEmotionalLoad());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<MentalStateCheckInResponse> getHistory(String userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_HISTORY_LIMIT));
        return checkInRepository
                .findAllByUserIdOrderByRecordedAtDesc(userId, PageRequest.of(0, safeLimit))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private MentalStateCheckInResponse toResponse(MentalStateCheckIn checkIn) {
        MentalStateAssessment assessment = adviceService.assess(
                checkIn.getEnergy(), checkIn.getActivation(), checkIn.getStimulationHunger(),
                checkIn.getClarity(), checkIn.getValence(), checkIn.getEmotionalLoad());
        return MentalStateCheckInResponse.from(checkIn, assessment);
    }

    private void validate(CreateMentalStateCheckInRequest request) {
        if (request == null) throw new IllegalArgumentException("A mental state check-in is required.");
        validateRating("Energy", request.energy());
        validateRating("Activation", request.activation());
        validateRating("Stimulation Hunger", request.stimulationHunger());
        validateRating("Clarity", request.clarity());
        validateRating("Valence", request.valence());
        validateRating("Emotional Load", request.emotionalLoad());
    }

    private void validateRating(String name, int rating) {
        if (rating < 1 || rating > 10) {
            throw new IllegalArgumentException(name + " must be between 1 and 10.");
        }
    }
}
