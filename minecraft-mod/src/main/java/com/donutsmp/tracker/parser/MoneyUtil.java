package com.donutsmp.tracker.parser;

import java.math.BigDecimal;
import java.util.Map;

public final class MoneyUtil {
    private static final Map<Character, BigDecimal> SUFFIX = Map.of(
            'K', BigDecimal.valueOf(1_000L),
            'M', BigDecimal.valueOf(1_000_000L),
            'B', BigDecimal.valueOf(1_000_000_000L),
            'T', BigDecimal.valueOf(1_000_000_000_000L));

    /** "$ 63.7K" → "63700"; returns null when unparseable (never throws, never guesses). */
    public static String parse(String raw) {
        if (raw == null) return null;
        String s = raw.trim().replace("$", "").replace(",", "").replace(" ", "");
        if (s.isEmpty()) return null;
        char last = Character.toUpperCase(s.charAt(s.length() - 1));
        BigDecimal mult = SUFFIX.get(last);
        if (mult != null) s = s.substring(0, s.length() - 1);
        else mult = BigDecimal.ONE;
        if (!s.matches("\\d+(\\.\\d+)?")) return null;
        try {
            BigDecimal result = new BigDecimal(s).multiply(mult);
            return result.stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
