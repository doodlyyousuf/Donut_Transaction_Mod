package com.donutsmp.tracker.web;

import com.donutsmp.tracker.DonutTrackerClient;
import com.donutsmp.tracker.config.TrackerConfig;
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

    public static int openDashboard(net.minecraft.fabric.api.client.command.v2.FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        String url = "http://localhost:" + cfg.webPort;
        post(cfg, "/api/dashboard/start");
        Util.getOperatingSystem().open(URI.create(url));
        src.sendFeedback(Text.literal(
                "§aTransaction Tracker Web Dashboard started: §f" + url));
        return 1;
    }

    public static int stopDashboard(net.minecraft.fabric.api.client.command.v2.FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        post(cfg, "/api/dashboard/stop");
        src.sendFeedback(Text.literal("§cTransaction Tracker Web Dashboard stopped."));
        return 1;
    }

    public static int restartDashboard(net.minecraft.fabric.api.client.command.v2.FabricClientCommandSource src) {
        TrackerConfig cfg = TrackerConfig.load();
        post(cfg, "/api/dashboard/restart");
        src.sendFeedback(Text.literal("§eTransaction Tracker Web Dashboard restarting..."));
        return 1;
    }

    private static void post(TrackerConfig cfg, String path) {
        CompletableFuture.runAsync(() -> {
            try {
                HttpClient.newHttpClient().send(HttpRequest.newBuilder()
                        .uri(URI.create(cfg.backendUrl + path))
                        .timeout(Duration.ofSeconds(5))
                        .header("X-API-Key", cfg.apiKey)
                        .POST(HttpRequest.BodyPublishers.noBody()).build(),
                        HttpResponse.BodyHandlers.discarding());
            } catch (Exception e) {
                DonutTrackerClient.LOGGER.info("[TransactionTracker] Backend unavailable");
            }
        });
    }
}
