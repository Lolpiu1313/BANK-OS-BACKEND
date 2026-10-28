package com.bankos.dto;

import com.bankos.model.Invoice;
import com.bankos.model.InvoiceStatus;

import java.math.BigDecimal;

/** Extraction result for one uploaded invoice PDF (page text is not included). */
public record InvoiceResponse(
        String sourceFile,
        Integer sourcePage,
        String number,
        String supplier,
        BigDecimal amount,
        String currency,
        String paymentReference,
        InvoiceStatus status,
        String extractionMethod,
        String verificationNotes
) {

    public static InvoiceResponse from(Invoice i) {
        return new InvoiceResponse(i.getSourceFile(), i.getSourcePage(), i.getNumber(), i.getSupplier(),
                i.getAmount(), i.getCurrency(), i.getPaymentReference(), i.getStatus(),
                i.getExtractionMethod(), i.getVerificationNotes());
    }
}
