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
    private static TrackerState state;
    private static final Gson GSON = new Gson();
    private static volatile boolean syncing;
    private static final CompletableFuture<Void> IMMEDIATE = new CompletableFuture<>();

    public static void start(TrackerConfig config, TrackerState trackerState) {
        cfg = config; state = trackerState;
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "DonutTracker-Sync");
            t.setDaemon(true);
            return t;
        });
        exec.scheduleWithFixedDelay(SyncService::syncOnce,
                config.syncIntervalSeconds, config.syncIntervalSeconds, TimeUnit.SECONDS);
    }

    public static void requestImmediateSync() { syncOnce(); }

    private static synchronized void syncOnce() {
        if (syncing || cfg == null) return;
        syncing = true;
        try {
            List<String> batch = state.queue == null ? List.of() : List.of();
            // (queue lives in TrackerState; expose via accessor below)
            batch = drainQueue();
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
