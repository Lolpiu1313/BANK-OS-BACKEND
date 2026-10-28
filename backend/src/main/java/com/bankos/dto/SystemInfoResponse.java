package com.bankos.dto;

import java.util.List;

/** Read-only runtime configuration: AI mode, agent limits and upload limits. Never exposes secrets. */
public record SystemInfoResponse(
        String aiMode,
        String chatModel,
        int aiTimeoutSeconds,
        int maxToolCallsPerInvestigation,
        int maxInvestigationsPerBatch,
        boolean asyncProcessing,
        int maxInvoicesPerBatch,
        long maxFileSizeBytes,
        long maxRequestSizeBytes,
        List<Tool> investigatorTools
) {

    public record Tool(String name, String description) {}
}
