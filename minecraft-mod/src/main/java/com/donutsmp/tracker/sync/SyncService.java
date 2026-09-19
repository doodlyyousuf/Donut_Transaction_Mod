package com.donutsmp.tracker.sync;

import com.donutsmp.tracker.DonutTrackerClient;
import com.donutsmp.tracker.config.TrackerConfig;
import com.donutsmp.tracker.core.TrackerState;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public final class SyncService {
    private static ScheduledExecutorService exec;
    private static HttpClient http;
    private static TrackerConfig cfg;
    private static final Gson GSON = new Gson();
    private static volatile boolean syncing;
    private static final CompletableFuture<Void> IMMEDIATE = new CompletableFuture<>();

    public static void start(TrackerConfig config, TrackerState trackerState) {
        cfg = config;
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "DonutTracker-Sync");
            t.setDaemon(true);
            return t;
        });
        exec.execute(SyncService::ensureApiKey);
        exec.scheduleWithFixedDelay(SyncService::syncOnce,
                config.syncIntervalSeconds, config.syncIntervalSeconds, TimeUnit.SECONDS);
    }

    public static void requestImmediateSync() { syncOnce(); }

    /**
     * Ask the backend for a one-time link code so the player can sign the
     * dashboard in to their own private view. Only the username is sent; no
     * Minecraft credentials of any kind leave the game.
     */
    public static CompletableFuture<String> requestLinkCode(String username) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                ensureApiKey();
                TrackerConfig live = cfg != null ? cfg : TrackerConfig.load();
                if (!live.hasApiKey()) {
                    return "§c[Tracker] No API key yet — is the backend running?";
                }
                String body = GSON.toJson(Map.of("username", username, "issued_by", username));
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5)).build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(live.backendUrl + "/api/auth/link/start"))
                        .timeout(Duration.ofSeconds(8))
                        .header("Content-Type", "application/json")
                        .header("X-API-Key", live.apiKey)
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();
                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() != 200) {
                    return "§c[Tracker] Could not create a link code (HTTP "
                            + res.statusCode() + ").";
                }
                JsonObject json = GSON.fromJson(res.body(), JsonObject.class);
                if (json == null || !json.has("code")) {
                    return "§c[Tracker] Backend returned no link code.";
                }
                String code = json.get("code").getAsString();
                int seconds = json.has("expires_in") ? json.get("expires_in").getAsInt() : 300;
                int minutes = Math.max(1, seconds / 60);
                return "§a[Tracker] Your link code is §f§l" + code
                        + "§r§7 — enter it in the dashboard within §f" + minutes
                        + "§7 minutes.";
            } catch (Exception e) {
                return "§c[Tracker] Backend unreachable — link code not created.";
            }
        });
    }

    /** Pull the server-generated key once and save it to the mod config. */
    public static synchronized void ensureApiKey() {
        TrackerConfig live = cfg != null ? cfg : TrackerConfig.load();
        if (live.hasApiKey()) {
            cfg = live;
            return;
        }
        if (http == null) {
            http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        }
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(live.backendUrl + "/api/bootstrap"))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return;
            JsonObject json = GSON.fromJson(res.body(), JsonObject.class);
            if (json == null || !json.has("api_key")) return;
            String key = json.get("api_key").getAsString();
            if (key == null || key.isBlank()) return;
            live.apiKey = key;
            live.save();
            cfg = live;
            DonutTrackerClient.LOGGER.info("[TransactionTracker] API key saved from backend");
        } catch (Exception ignored) {
        }
    }

    private static synchronized void syncOnce() {
        if (syncing || cfg == null) return;
        syncing = true;
        try {
            ensureApiKey();
            if (!cfg.hasApiKey()) return;
            List<String> batch = drainQueue();
            if (batch.isEmpty()) return;

            String body = GSON.toJson(Map.of("transactions",
                    batch.stream().map(s -> GSON.fromJson(s, JsonObject.class)).toList()));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(cfg.backendUrl + "/api/transactions/bulk"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("X-API-Key", cfg.apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 200 && res.statusCode() < 300) {
                removeQueue(batch);
                DonutTrackerClient.LOGGER.info(
                        "[TransactionTracker] Transaction synchronized ({} records)", batch.size());
            } else {
                DonutTrackerClient.LOGGER.warn(
                        "[TransactionTracker] Backend rejected sync: HTTP {}", res.statusCode());
            }
        } catch (Exception e) {
            DonutTrackerClient.LOGGER.info("[TransactionTracker] Backend unavailable; retrying later");
        } finally {
            syncing = false;
        }
    }

    // small indirection so TrackerState can keep queue private
    private static java.util.function.Supplier<com.donutsmp.tracker.queue.OfflineQueue> QUEUE =
            () -> { throw new IllegalStateException("not wired"); };
    public static void wireQueue(com.donutsmp.tracker.queue.OfflineQueue q) { QUEUE = () -> q; }
    private static List<String> drainQueue() { return QUEUE.get().drain(100); }
    private static void removeQueue(List<String> sent) { QUEUE.get().remove(sent); }
}
