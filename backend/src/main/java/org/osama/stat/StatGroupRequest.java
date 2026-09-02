package org.osama.stat;

import lombok.Data;

import java.util.List;

@Data
public class StatGroupRequest {
    private String name;
    private List<String> statDefinitionIds;
}
