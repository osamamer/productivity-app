package org.osama.stat;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.EnumMap;
import java.util.Map;
import java.util.StringJoiner;

@Converter
public class StatInputValuesConverter implements AttributeConverter<Map<StatType, Double>, String> {

    @Override
    public String convertToDatabaseColumn(Map<StatType, Double> values) {
        if (values == null || values.isEmpty()) return "";
        StringJoiner encoded = new StringJoiner(",");
        values.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> encoded.add(entry.getKey().name() + "=" + entry.getValue()));
        return encoded.toString();
    }

    @Override
    public Map<StatType, Double> convertToEntityAttribute(String storedValues) {
        Map<StatType, Double> values = new EnumMap<>(StatType.class);
        if (storedValues == null || storedValues.isBlank()) return values;
        for (String pair : storedValues.split(",")) {
            String[] parts = pair.split("=", 2);
            if (parts.length != 2) throw new IllegalArgumentException("Invalid stored stat input value.");
            values.put(StatType.valueOf(parts[0]), Double.valueOf(parts[1]));
        }
        return values;
    }
}
