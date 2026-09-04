package org.osama.mentalthread;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class MentalThreadService {
    private static final int HIGH_LOAD_THRESHOLD = 7;

    private final MentalThreadRepository mentalThreadRepository;
    private final MentalThreadLoadEntryRepository loadEntryRepository;
    private final MentalCapacityCheckInRepository capacityRepository;
    private final UserRepository userRepository;

    public MentalThreadService(MentalThreadRepository mentalThreadRepository,
                               MentalThreadLoadEntryRepository loadEntryRepository,
                               MentalCapacityCheckInRepository capacityRepository,
                               UserRepository userRepository) {
        this.mentalThreadRepository = mentalThreadRepository;
        this.loadEntryRepository = loadEntryRepository;
        this.capacityRepository = capacityRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<MentalThreadResponse> getThreads(String userId, boolean includeClosed) {
        List<MentalThread> threads = includeClosed
                ? mentalThreadRepository.findAllByUserId(userId)
                : mentalThreadRepository.findAllByUserIdAndStatus(userId, MentalThreadStatus.OPEN);

        return threads.stream()
                .sorted(threadOrder())
                .map(MentalThreadResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentalThreadResponse getThread(String threadId, String userId) {
        return MentalThreadResponse.from(findOwnedThread(threadId, userId));
    }

    @Transactional
    public MentalThreadResponse createThread(CreateMentalThreadRequest request, String userId) {
        User user = findUser(userId);
        MentalThread mentalThread = MentalThread.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .title(validateRequiredText(request.title(), "Title", 160))
                .description(normalizeOptionalText(request.description(), "Description", 5000))
                .status(MentalThreadStatus.OPEN)
                .attentionState(request.attentionState())
                .desiredResolution(normalizeOptionalText(request.desiredResolution(), "Desired resolution", 5000))
                .targetCloseDate(request.targetCloseDate())
                .hardDeadlineDate(request.hardDeadlineDate())
                .nextReviewDate(request.nextReviewDate())
                .currentMentalLoad(validateRating(request.currentMentalLoad(), "Mental load"))
                .build();

        MentalThread savedThread = mentalThreadRepository.save(mentalThread);
        recordLoad(savedThread, request.currentMentalLoad(), request.loadReason());
        log.info("Mental thread created: userId={} threadId={} attentionState={} mentalLoad={}",
                userId, savedThread.getId(), savedThread.getAttentionState(), savedThread.getCurrentMentalLoad());
        return MentalThreadResponse.from(savedThread);
    }

    @Transactional
    public MentalThreadResponse updateThread(String threadId, UpdateMentalThreadRequest request, String userId) {
        MentalThread mentalThread = findOwnedThread(threadId, userId);
        ensureOpen(mentalThread);
        int previousLoad = mentalThread.getCurrentMentalLoad();
        AttentionState previousAttentionState = mentalThread.getAttentionState();

        mentalThread.setTitle(validateRequiredText(request.title(), "Title", 160));
        mentalThread.setDescription(normalizeOptionalText(request.description(), "Description", 5000));
        mentalThread.setAttentionState(request.attentionState());
        mentalThread.setDesiredResolution(normalizeOptionalText(request.desiredResolution(), "Desired resolution", 5000));
        mentalThread.setTargetCloseDate(request.targetCloseDate());
        mentalThread.setHardDeadlineDate(request.hardDeadlineDate());
        mentalThread.setNextReviewDate(request.nextReviewDate());
        mentalThread.setCurrentMentalLoad(validateRating(request.currentMentalLoad(), "Mental load"));

        MentalThread savedThread = mentalThreadRepository.save(mentalThread);
        if (previousLoad != request.currentMentalLoad()
                || previousAttentionState != request.attentionState()) {
            recordLoad(savedThread, request.currentMentalLoad(), request.loadReason());
        }
        log.info("Mental thread updated: userId={} threadId={} attentionState={} mentalLoad={}",
                userId, threadId, savedThread.getAttentionState(), savedThread.getCurrentMentalLoad());
        return MentalThreadResponse.from(savedThread);
    }

    @Transactional
    public MentalThreadResponse closeThread(String threadId, CloseMentalThreadRequest request, String userId) {
        MentalThread mentalThread = findOwnedThread(threadId, userId);
        ensureOpen(mentalThread);
        mentalThread.setStatus(MentalThreadStatus.CLOSED);
        mentalThread.setClosureType(request.closureType());
        mentalThread.setResolutionSummary(normalizeOptionalText(
                request.resolutionSummary(), "Resolution summary", 5000));
        mentalThread.setClosedAt(LocalDateTime.now());
        mentalThread.setCurrentMentalLoad(0);

        MentalThread savedThread = mentalThreadRepository.save(mentalThread);
        recordLoad(savedThread, 0, null);
        log.info("Mental thread closed: userId={} threadId={} closureType={}",
                userId, threadId, request.closureType());
        return MentalThreadResponse.from(savedThread);
    }

    @Transactional
    public MentalThreadResponse reopenThread(String threadId, String userId) {
        MentalThread mentalThread = findOwnedThread(threadId, userId);
        if (mentalThread.getStatus() == MentalThreadStatus.OPEN) {
            throw new IllegalArgumentException("Mental thread is already open: " + threadId);
        }
        int restoredLoad = loadEntryRepository.findAllByMentalThreadIdOrderByRecordedAtAsc(threadId).stream()
                .filter(entry -> entry.getLoad() > 0)
                .reduce((first, second) -> second)
                .map(MentalThreadLoadEntry::getLoad)
                .orElse(1);
        mentalThread.setStatus(MentalThreadStatus.OPEN);
        mentalThread.setClosureType(null);
        mentalThread.setResolutionSummary(null);
        mentalThread.setClosedAt(null);
        mentalThread.setCurrentMentalLoad(restoredLoad);

        MentalThread savedThread = mentalThreadRepository.save(mentalThread);
        recordLoad(savedThread, restoredLoad, null);
        log.info("Mental thread reopened: userId={} threadId={}", userId, threadId);
        return MentalThreadResponse.from(savedThread);
    }

    @Transactional
    public void deleteThread(String threadId, String userId) {
        MentalThread mentalThread = findOwnedThread(threadId, userId);
        loadEntryRepository.deleteAllByMentalThreadId(threadId);
        mentalThreadRepository.delete(mentalThread);
        log.info("Mental thread deleted: userId={} threadId={}", userId, threadId);
    }

    @Transactional(readOnly = true)
    public List<MentalThreadLoadEntryResponse> getLoadHistory(String threadId, String userId) {
        findOwnedThread(threadId, userId);
        return loadEntryRepository.findAllByMentalThreadIdOrderByRecordedAtAsc(threadId).stream()
                .map(MentalThreadLoadEntryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public MentalThreadSummaryResponse getSummary(String userId) {
        List<MentalThread> openThreads = mentalThreadRepository.findAllByUserIdAndStatus(
                userId, MentalThreadStatus.OPEN);
        Integer capacityToday = capacityRepository.findByUserIdAndDate(userId, LocalDate.now())
                .map(MentalCapacityCheckIn::getCapacity)
                .orElse(null);

        return new MentalThreadSummaryResponse(
                openThreads.size(),
                openThreads.stream().mapToInt(MentalThread::getCurrentMentalLoad).sum(),
                (int) openThreads.stream()
                        .filter(thread -> thread.getCurrentMentalLoad() >= HIGH_LOAD_THRESHOLD)
                        .count(),
                countByState(openThreads, AttentionState.ACTING),
                countByState(openThreads, AttentionState.RUMINATING),
                countByState(openThreads, AttentionState.PLANNED),
                countByState(openThreads, AttentionState.PENDING),
                capacityToday
        );
    }

    @Transactional
    public CapacityCheckInResponse checkInCapacity(int capacity, String userId) {
        validateRating(capacity, "Mental capacity");
        LocalDate today = LocalDate.now();
        MentalCapacityCheckIn checkIn = capacityRepository.findByUserIdAndDate(userId, today)
                .orElseGet(() -> MentalCapacityCheckIn.builder()
                        .id(UUID.randomUUID().toString())
                        .user(findUser(userId))
                        .date(today)
                        .build());
        checkIn.setCapacity(capacity);
        MentalCapacityCheckIn savedCheckIn = capacityRepository.save(checkIn);
        log.info("Mental capacity recorded: userId={} date={} capacity={}", userId, today, capacity);
        return CapacityCheckInResponse.from(savedCheckIn);
    }

    private MentalThread findOwnedThread(String threadId, String userId) {
        return mentalThreadRepository.findByIdAndUserId(threadId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Mental thread not found: " + threadId));
    }

    private User findUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private void recordLoad(MentalThread mentalThread, int load, String reason) {
        loadEntryRepository.save(MentalThreadLoadEntry.builder()
                .id(UUID.randomUUID().toString())
                .mentalThread(mentalThread)
                .load(load)
                .attentionState(mentalThread.getAttentionState())
                .reason(normalizeOptionalText(reason, "Load reason", 500))
                .build());
    }

    private int countByState(List<MentalThread> threads, AttentionState state) {
        return (int) threads.stream()
                .filter(thread -> thread.getAttentionState() == state)
                .count();
    }

    private Comparator<MentalThread> threadOrder() {
        Comparator<MentalThread> targetDateOrder = Comparator.comparing(
                MentalThread::getTargetCloseDate,
                Comparator.nullsLast(Comparator.naturalOrder())
        );
        Comparator<MentalThread> loadOrder = Comparator.comparingInt(MentalThread::getCurrentMentalLoad).reversed();
        Comparator<MentalThread> updatedOrder = Comparator.comparing(
                MentalThread::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        );
        return Comparator.comparing(MentalThread::getStatus)
                .thenComparing(loadOrder)
                .thenComparing(targetDateOrder)
                .thenComparing(updatedOrder);
    }

    private String normalizeOptionalText(String value, String fieldName, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " must be " + maxLength + " characters or fewer.");
        }
        return normalized;
    }

    private String validateRequiredText(String value, String fieldName, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " must not be blank.");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " must be " + maxLength + " characters or fewer.");
        }
        return normalized;
    }

    private int validateRating(int rating, String fieldName) {
        if (rating < 1 || rating > 10) {
            throw new IllegalArgumentException(fieldName + " must be between 1 and 10.");
        }
        return rating;
    }

    private void ensureOpen(MentalThread mentalThread) {
        if (mentalThread.getStatus() != MentalThreadStatus.OPEN) {
            throw new IllegalArgumentException("Closed mental threads must be reopened before editing.");
        }
    }
}
