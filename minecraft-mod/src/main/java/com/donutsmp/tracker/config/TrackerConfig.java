package com.donutsmp.tracker.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import java.io.IOException;
import java.nio.file.*;

public class TrackerConfig {
    public static final String DEFAULT_BACKEND_URL = "https://donutstats.asifent.com";

    /**
     * The shared key is stored obfuscated and reassembled from fragments, so it
     * does not appear as plaintext in the jar. {@link SecretCodec} documents the
     * (limited) protection this provides.
     */
    private static final String[] KEY_PARTS = {
            "MxE3CBBYICQYG", "w8obHQTYTY2Nzc", "pTTVlfgA-BwgB", "EBQ-KwNgJTU0Aw",
    };

    public String backendUrl = DEFAULT_BACKEND_URL;
    public int webPort = 18701;
    /** Working value; never written to disk directly (see {@link #apiKeyEnc}). */
    public transient String apiKey = defaultApiKey();
    /** Obfuscated form persisted in the JSON config. */
    public String apiKeyEnc;
    public boolean trackingEnabled = true;
    public boolean autoStartWeb = false;
    public boolean saveRawMessages = true;
    public int syncIntervalSeconds = 10;
    public boolean debugLogging = false;

    /** Run a balance check after transactions so the dashboard stays current. */
    public boolean autoBalanceCheck = true;
    /** Command used for balance checks (without the leading slash). */
    public String balanceCommand = "bal";
    /** Minimum gap between automatic balance checks, in seconds. */
    public int balanceCheckCooldownSeconds = 15;
    /** Extra periodic balance check every N seconds; 0 disables it. */
    public int balanceCheckPeriodicSeconds = 0;

    private static final Path DIR =
            FabricLoader.getInstance().getConfigDir().resolve("donutsmp-transaction-tracker");
    private static final Path FILE = DIR.resolve("donutsmp-transaction-tracker.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static String defaultApiKey() {
        return SecretCodec.decode(String.join("", KEY_PARTS));
    }

    public static TrackerConfig load() {
        try {
            Files.createDirectories(DIR);
            if (Files.exists(FILE)) {
                JsonObject obj = JsonParser.parseString(Files.readString(FILE)).getAsJsonObject();
                TrackerConfig c = GSON.fromJson(obj, TrackerConfig.class);
                if (c == null) c = new TrackerConfig();

                boolean dirty = false;
                // Prefer the obfuscated field; fall back to a legacy plaintext key.
                if (c.apiKeyEnc != null && !c.apiKeyEnc.isBlank()) {
                    String decoded = SecretCodec.decode(c.apiKeyEnc);
                    if (!decoded.isBlank()) c.apiKey = decoded;
                } else if (obj.has("apiKey")) {
                    JsonElement legacy = obj.get("apiKey");
                    if (legacy != null && legacy.isJsonPrimitive()) {
                        c.apiKey = legacy.getAsString();
                        dirty = true;   // rewrite it obfuscated
                    }
                }

                if (c.migrateToLiveHost()) dirty = true;
                if (dirty) c.save();
                return c;
            }
            TrackerConfig c = new TrackerConfig();
            c.save();
            return c;
        } catch (Exception e) {
            return new TrackerConfig();
        }
    }

    public void save() {
        try {
            Files.createDirectories(DIR);
            apiKeyEnc = SecretCodec.encode(apiKey);
            Files.writeString(FILE, GSON.toJson(this));
        } catch (IOException ignored) {
        }
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** The balance command without a leading slash, falling back to "bal". */
    public String balanceCommandName() {
        String c = balanceCommand == null ? "" : balanceCommand.trim();
        if (c.startsWith("/")) c = c.substring(1).trim();
        return c.isEmpty() ? "bal" : c;
    }

    /**
     * Rewrite leftover local-dev defaults so a previously generated config still
     * talks to the hosted tracker after dropping in a new jar. Custom URLs are
     * left alone.
     */
    boolean migrateToLiveHost() {
        boolean dirty = false;
        boolean staleUrl = backendUrl == null || backendUrl.isBlank() || isStaleBackendUrl(backendUrl);
        if (staleUrl) {
            backendUrl = DEFAULT_BACKEND_URL;
            dirty = true;
        }
        if (apiKey == null || apiKey.isBlank() || staleUrl) {
            apiKey = defaultApiKey();
            dirty = true;
        }
        return dirty;
    }

    static boolean isStaleBackendUrl(String url) {
        String u = url.trim().toLowerCase();
        if (u.contains("localhost") || u.contains("127.0.0.1")) return true;
        if (u.contains("161.97.107.236")) return true;
        return false;
    }
}
