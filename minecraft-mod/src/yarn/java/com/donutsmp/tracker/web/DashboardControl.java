package com.donutsmp.tracker.web;

import com.donutsmp.tracker.DonutTrackerClient;
import com.donutsmp.tracker.config.TrackerConfig;
import com.donutsmp.tracker.sync.SyncService;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public final class DashboardControl {
    public static CompletableFuture<Boolean> statusAsync() {
        TrackerConfig cfg = TrackerConfig.load();
        return CompletableFuture.supplyAsync(() -> {
            try {
                HttpResponse<String> r = HttpClient.newHttpClient().send(
                        HttpRequest.newBuilder(URI.create(cfg.backendUrl + "/api/health"))
                                .timeout(Duration.ofSeconds(3)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                return r.statusCode() == 200;
            } catch (Exception e) { return false; }
        });
    }

    public static int openDashboard(FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        String url = cfg.backendUrl;
        Util.getOperatingSystem().open(URI.create(url));
        src.sendFeedback(Text.literal(
                "§aTransaction Tracker dashboard: §f" + url));
        return 1;
    }

    public static int stopDashboard(FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        post("/api/dashboard/stop");
        src.sendFeedback(Text.literal("§cTransaction Tracker Web Dashboard stopped."));
        return 1;
    }

    public static int restartDashboard(FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        post("/api/dashboard/restart");
        src.sendFeedback(Text.literal("§eTransaction Tracker Web Dashboard restarting..."));
        return 1;
    }

    private static void post(String path) {
        CompletableFuture.runAsync(() -> {
            try {
                SyncService.ensureApiKey();
                TrackerConfig live = TrackerConfig.load();
                HttpClient.newHttpClient().send(HttpRequest.newBuilder()
                        .uri(URI.create(live.backendUrl + path))
                        .timeout(Duration.ofSeconds(5))
                        .header("X-API-Key", live.apiKey)
                        .POST(HttpRequest.BodyPublishers.noBody()).build(),
                        HttpResponse.BodyHandlers.discarding());
            } catch (Exception e) {
                DonutTrackerClient.LOGGER.info("[TransactionTracker] Backend unavailable");
            }
        });
    }
}
