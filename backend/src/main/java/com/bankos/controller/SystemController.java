package com.bankos.controller;

import com.bankos.agent.InvestigationTools;
import com.bankos.config.BankosProperties;
import com.bankos.dto.SystemInfoResponse;
import com.bankos.service.BatchService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.unit.DataSize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final BankosProperties properties;
    private final String chatModel;
    private final DataSize maxFileSize;
    private final DataSize maxRequestSize;

    public SystemController(BankosProperties properties,
                            @Value("${spring.ai.openai.chat.model:}") String chatModel,
                            @Value("${spring.servlet.multipart.max-file-size:1MB}") DataSize maxFileSize,
                            @Value("${spring.servlet.multipart.max-request-size:10MB}") DataSize maxRequestSize) {
        this.properties = properties;
        this.chatModel = chatModel;
        this.maxFileSize = maxFileSize;
        this.maxRequestSize = maxRequestSize;
    }

    /** Agent limits and runtime mode, for the dashboard's system tab. */
    @GetMapping
    public SystemInfoResponse info() {
        BankosProperties.AiMode mode = properties.ai().mode();
        return new SystemInfoResponse(
                mode.name(),
                mode == BankosProperties.AiMode.LIVE ? chatModel : null,
                properties.ai().timeoutSeconds(),
                properties.ai().maxToolCalls(),
                properties.processing().maxInvestigationsPerBatch(),
                properties.processing().async(),
                BatchService.MAX_INVOICES,
                maxFileSize.toBytes(),
                maxRequestSize.toBytes(),
                List.of(
                        new SystemInfoResponse.Tool(InvestigationTools.TOOL_EVIDENCE,
                                "Retrieve verified transaction and invoice evidence for a case (required)"),
                        new SystemInfoResponse.Tool(InvestigationTools.TOOL_POLICY,
                                "Retrieve the applicable banking policy for a case")));
    }
}
