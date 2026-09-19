package com.donutsmp.tracker.parser;

import java.util.regex.*;

public final class QtyUtil {
    private static final Pattern P =
            Pattern.compile("^(?<num>\\d+(?:\\.\\d+)?)(?<suffix>[KMB])?$", Pattern.CASE_INSENSITIVE);

    public static Long parse(String raw) {           // "10,000" → 10000, "1K" → 1000
        if (raw == null) return null;
        Matcher m = P.matcher(raw.replace(",", "").trim());
        if (!m.matches()) return null;
        double value = Double.parseDouble(m.group("num"));
        String suffix = m.group("suffix");
        if (suffix != null) {
            value *= switch (suffix.toUpperCase()) {
                case "K" -> 1_000d;
                case "M" -> 1_000_000d;
                default -> 1_000_000_000d;
            };
        }
        return Math.round(value);
    }
}
