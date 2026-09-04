package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SystemStatProvisioningService {

    private final StatDefinitionRepository definitionRepository;
    private final StatService statService;
    private final UserRepository userRepository;

    public SystemStatProvisioningService(StatDefinitionRepository definitionRepository,
                                         StatService statService,
                                         UserRepository userRepository) {
        this.definitionRepository = definitionRepository;
        this.statService = statService;
        this.userRepository = userRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void createMissingSystemStatsForExistingUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(this::createMissingSystemStatsFor);
        if (!users.isEmpty()) {
            log.info("System stat provisioning checked for existing users: userCount={}", users.size());
        }
    }

    @Transactional
    public void createMissingSystemStatsFor(User user) {
        List<StatDefinition> userStats = definitionRepository.findAllByUserId(user.getId());
        Set<String> existingSystemKeys = userStats.stream()
                .map(StatDefinition::getSystemKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        int createdCount = 0;
        int updatedCount = 0;

        for (SystemStatDefinition systemStat : SystemStatCatalog.SYSTEM_STATS) {
            if (existingSystemKeys.contains(systemStat.systemKey())) {
                continue;
            }

            Optional<StatDefinition> existingDefinition =
                    definitionRepository.findByUserIdAndNameIgnoreCase(user.getId(), systemStat.name());
            if (existingDefinition.isPresent()) {
                applySystemDefinition(existingDefinition.get(), systemStat);
                updatedCount++;
            } else {
                statService.createSystemDefinition(systemStat, user);
                createdCount++;
            }
        }

        if (createdCount > 0 || updatedCount > 0) {
            log.info("System stats provisioned: userId={} createdCount={} updatedCount={}",
                    user.getId(), createdCount, updatedCount);
        }
    }

    private void applySystemDefinition(StatDefinition definition, SystemStatDefinition systemStat) {
        definition.setName(systemStat.name());
        definition.setDescription(systemStat.description());
        definition.setType(systemStat.type());
        definition.setMinValue(systemStat.minValue());
        definition.setMaxValue(systemStat.maxValue());
        definition.setMorality(systemStat.morality());
        definition.setGoodThreshold(systemStat.goodThreshold());
        definition.setSystemKey(systemStat.systemKey());
        definitionRepository.save(definition);
    }
}
