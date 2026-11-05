package org.osama.stat;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.List;

@Converter
public class StatTypeListConverter implements AttributeConverter<List<StatType>, String> {

    @Override
    public String convertToDatabaseColumn(List<StatType> types) {
        return types == null ? "" : types.stream().map(Enum::name).reduce((left, right) -> left + "," + right)
                .orElse("");
    }

    @Override
    public List<StatType> convertToEntityAttribute(String storedTypes) {
        if (storedTypes == null || storedTypes.isBlank()) return List.of();
        return Arrays.stream(storedTypes.split(","))
                .map(StatType::valueOf)
                .toList();
    }
}
