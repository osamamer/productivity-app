package org.osama.path;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.stat.StatDefinition;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PathService {
    public static final int MAX_NAME_LENGTH = 60;
    // Keys the web app maps to its own icons.
    static final Set<String> ICONS = Set.of(
            "writer", "engineer", "money", "body", "mind", "people", "learn", "art", "music", "home", "nature", "spirit");
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final PathRepository pathRepository;
    private final PathViewPreferenceRepository viewRepository;
    private final SignalFactory signalFactory;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PathResponse> getPaths(String userId) {
        List<Path> paths = pathRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
        return describe(paths, userId);
    }

    @Transactional(readOnly = true)
    public PathResponse getPath(String pathId, String userId) {
        return describe(List.of(findOwned(pathId, userId)), userId).get(0);
    }

    @Transactional
    public PathResponse createPath(PathRequest request, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        Path path = new Path();
        path.setId(UUID.randomUUID().toString());
        path.setUser(user);
        path.setName(validateName(request.name()));
        path.setColor(validateColor(request.color() == null ? "#A395F2" : request.color()));
        path.setIcon(validateIcon(request.icon() == null ? "mind" : request.icon()));
        path.setPaused(Boolean.TRUE.equals(request.paused()));
        path.setDisplayOrder(request.displayOrder() != null
                ? request.displayOrder()
                : (int) pathRepository.countByUserId(userId));
        path.setSignal(signalFactory.build(request.signal(), path, userId));
        Path saved = pathRepository.save(path);
        log.info("Path created: userId={} pathId={} inputs={}", userId, saved.getId(), saved.getSignal().getInputs().size());
        return getPath(saved.getId(), userId);
    }

    @Transactional
    public PathResponse updatePath(String pathId, PathRequest request, String userId) {
        Path path = findOwned(pathId, userId);
        if (request.name() != null) path.setName(validateName(request.name()));
        if (request.color() != null) path.setColor(validateColor(request.color()));
        if (request.icon() != null) path.setIcon(validateIcon(request.icon()));
        if (request.paused() != null) path.setPaused(request.paused());
        if (request.displayOrder() != null) path.setDisplayOrder(request.displayOrder());
        if (request.signal() != null) replaceSignalOf(path, request.signal(), userId);
        pathRepository.saveAndFlush(path);
        log.info("Path updated: userId={} pathId={}", userId, pathId);
        return getPath(pathId, userId);
    }

    @Transactional
    public PathResponse replaceSignal(String pathId, SignalRequest request, String userId) {
        Path path = findOwned(pathId, userId);
        replaceSignalOf(path, request, userId);
        pathRepository.saveAndFlush(path);
        log.info("Path signal replaced: userId={} pathId={} inputs={}", userId, pathId, path.getSignal().getInputs().size());
        return getPath(pathId, userId);
    }

    @Transactional
    public void deletePath(String pathId, String userId) {
        pathRepository.delete(findOwned(pathId, userId));
        log.info("Path deleted: userId={} pathId={}", userId, pathId);
    }

    /** Sets "My order": paths named in {@code pathIds} take their position in it; others are left alone. */
    @Transactional
    public List<PathResponse> reorder(List<String> pathIds, String userId) {
        if (pathIds == null) throw new IllegalArgumentException("Path order is required.");
        for (int index = 0; index < pathIds.size(); index++) {
            findOwned(pathIds.get(index), userId).setDisplayOrder(index);
        }
        log.info("Paths reordered: userId={} count={}", userId, pathIds.size());
        return getPaths(userId);
    }

    @Transactional(readOnly = true)
    public PathViewResponse getView(String userId) {
        return viewRepository.findById(userId).map(PathViewResponse::from).orElseGet(PathViewResponse::defaults);
    }

    @Transactional
    public PathViewResponse updateView(PathViewRequest request, String userId) {
        PathViewPreference preference = viewRepository.findById(userId).orElseGet(() -> {
            PathViewPreference created = new PathViewPreference();
            created.setUserId(userId);
            return created;
        });
        if (request.sort() != null) preference.setSort(request.sort());
        if (request.shape() != null) preference.setShape(request.shape());
        if (request.edges() != null) preference.setEdges(request.edges());
        return PathViewResponse.from(viewRepository.save(preference));
    }

    List<PathResponse> describe(List<Path> paths, String userId) {
        Map<String, StatDefinition> definitions = signalFactory.definitionsFor(
                paths.stream().map(Path::getSignal).toList(), userId);
        return paths.stream().map(path -> new PathResponse(path.getId(), path.getName(), path.getColor(), path.getIcon(),
                path.getDisplayOrder(), path.isPaused(), signalFactory.describe(path.getSignal(), definitions))).toList();
    }

    Path findOwned(String pathId, String userId) {
        return pathRepository.findByIdAndUserId(pathId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Path not found: " + pathId));
    }

    private void replaceSignalOf(Path path, SignalRequest request, String userId) {
        PathSignal replacement = signalFactory.build(request, path, userId);
        PathSignal signal = path.getSignal();
        // Keep the signal row (one per path) and swap its inputs, so the unique path_id never clashes.
        signal.setCombineMethod(replacement.getCombineMethod());
        signal.getInputs().clear();
        replacement.getInputs().forEach(input -> {
            input.setSignal(signal);
            signal.getInputs().add(input);
        });
    }

    private static String validateName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isEmpty() || normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Path name must contain between 1 and 60 characters.");
        }
        return normalized;
    }

    private static String validateColor(String color) {
        String normalized = color.trim();
        if (!HEX_COLOR.matcher(normalized).matches()) throw new IllegalArgumentException("Path colour is invalid.");
        return normalized.toUpperCase(Locale.ROOT);
    }

    private static String validateIcon(String icon) {
        if (!ICONS.contains(icon)) throw new IllegalArgumentException("Path icon is invalid.");
        return icon;
    }
}
