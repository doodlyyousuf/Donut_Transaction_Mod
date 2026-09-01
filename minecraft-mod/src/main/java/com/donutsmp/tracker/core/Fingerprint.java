package com.donutsmp.tracker.core;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class Fingerprint {
    public static String of(com.donutsmp.tracker.model.TransactionRecord t) {
        String canonical = String.join("|",
                nz(t.server), nz(t.transaction_owner), nz(t.transaction_type),
                nz(t.item_name), nz(String.valueOf(t.quantity)), nz(t.total_price),
                nz(t.normalized_message), nz(t.minecraft_timestamp));
        return sha256(canonical);
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
