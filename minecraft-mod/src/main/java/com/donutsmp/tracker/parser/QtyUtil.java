package com.donutsmp.tracker.parser;

public final class QtyUtil {
    public static Long parse(String raw) {           // "10,000" → 10000
        if (raw == null) return null;
        String s = raw.replace(",", "").trim();
        return s.matches("\\d+") ? Long.parseLong(s) : null;
    }
}
