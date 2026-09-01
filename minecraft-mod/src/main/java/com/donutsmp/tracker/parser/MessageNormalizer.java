package com.donutsmp.tracker.parser;

import java.util.regex.Pattern;

public final class MessageNormalizer {
    private static final Pattern LOG_PREFIX = Pattern.compile(
            "^\\[\\d{1,2}:\\d{2}:\\d{2}\\]\\s*\\[[^\\]]+\\]\\s*:\\s*");
    private static final Pattern COLOR = Pattern.compile("§.");

    /** "[13:42:44] [Render thread/INFO]: [CHAT] X listed ..." → "X listed ..." */
    public static String normalize(String raw) {
        if (raw == null) return "";
        String s = COLOR.matcher(raw).replaceAll("").trim();
        if (s.contains("[CHAT]")) {
            s = s.substring(s.lastIndexOf("[CHAT]") + 6).trim();
        } else {
            s = LOG_PREFIX.matcher(s).replaceFirst("").trim();
        }
        return s;
    }
}
