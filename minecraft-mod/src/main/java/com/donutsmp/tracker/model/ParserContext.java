package com.donutsmp.tracker.model;

public record ParserContext(
        String localPlayer, String rawMessage, String serverAddress,
        String serverLabel, String minecraftTimestamp) {}
