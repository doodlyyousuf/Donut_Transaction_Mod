package com.donutsmp.tracker.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import java.io.IOException;
import java.nio.file.*;

public class TrackerConfig {
    public String backendUrl = "http://localhost:8000";
    public int webPort = 8765;
    public String apiKey = "";           // X-API-Key; never hardcode a real key
    public boolean trackingEnabled = true;
    public boolean autoStartWeb = false;
    public boolean saveRawMessages = true;
    public int syncIntervalSeconds = 10;
    public boolean debugLogging = false;

    private static final Path DIR =
            FabricLoader.getInstance().getConfigDir().resolve("donutsmp-transaction-tracker");
    private static final Path FILE = DIR.resolve("donutsmp-transaction-tracker.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static TrackerConfig load() {
        try {
            Files.createDirectories(DIR);
            if (Files.exists(FILE)) {
                return GSON.fromJson(Files.readString(FILE), TrackerConfig.class);
            }
            TrackerConfig c = new TrackerConfig();
            Files.writeString(FILE, GSON.toJson(c));
            return c;
        } catch (IOException e) {
            return new TrackerConfig();
        }
    }
}
