package org.osama.stat;

import org.osama.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SystemStatProvisioningService {

    private final StatDefinitionRepository definitionRepository;
    private final StatService statService;

    public SystemStatProvisioningService(StatDefinitionRepository definitionRepository, StatService statService) {
        this.definitionRepository = definitionRepository;
        this.statService = statService;
    }

    @Transactional
    public void createMissingSystemStatsFor(User user) {
        List<StatDefinition> userStats = definitionRepository.findAllByUserId(user.getId());
        Set<String> existingSystemKeys = userStats.stream()
                .map(StatDefinition::getSystemKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (SystemStatDefinition systemStat : SystemStatCatalog.MENTAL_STATE_STATS) {
            if (existingSystemKeys.contains(systemStat.systemKey())) {
                continue;
            }

            definitionRepository.findByUserIdAndNameIgnoreCase(user.getId(), systemStat.name())
                    .ifPresentOrElse(
                            definition -> applySystemDefinition(definition, systemStat),
                            () -> statService.createSystemDefinition(systemStat, user)
                    );
        }
    }

    private void applySystemDefinition(StatDefinition definition, SystemStatDefinition systemStat) {
        definition.setName(systemStat.name());
        definition.setDescription(systemStat.description());
        definition.setType(systemStat.type());
        definition.setMinValue(systemStat.minValue());
        definition.setMaxValue(systemStat.maxValue());
        definition.setSystemKey(systemStat.systemKey());
        definitionRepository.save(definition);
    }
}
