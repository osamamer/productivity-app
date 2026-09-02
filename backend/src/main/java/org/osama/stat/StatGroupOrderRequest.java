package org.osama.stat;

import lombok.Data;

import java.util.List;

@Data
public class StatGroupOrderRequest {
    private List<String> groupIds;
}
