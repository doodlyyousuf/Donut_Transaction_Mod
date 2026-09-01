package com.donutsmp.tracker.core;

import com.donutsmp.tracker.DonutTrackerClient;
import com.donutsmp.tracker.config.TrackerConfig;
import com.donutsmp.tracker.model.*;
import com.donutsmp.tracker.parser.*;
import com.donutsmp.tracker.queue.OfflineQueue;
import com.google.gson.Gson;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

public final class TrackerState {
    public static TrackerState STATE;
    private final TrackerConfig config;
    private final OfflineQueue queue;
    private final Gson gson = new Gson();
    private final ExecutorService parseWorker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "DonutTracker-Parser");
        t.setDaemon(true);
        return t;
    });
    private final Deque<TransactionRecord> cache = new ConcurrentLinkedDeque<>();

    private volatile boolean active;
    private volatile String serverAddress;
    private volatile String localPlayer;

    public TrackerState(TrackerConfig config, OfflineQueue queue) {
        this.config = config;
        this.queue = queue;
    }

    public void onServerJoin(String address, boolean donut, String username) {
        this.serverAddress = address;
        this.localPlayer = username;
        this.active = donut && config.trackingEnabled;
    }

    public void onDisconnect() { this.active = false; }

    public void onChat(String raw) {
        if (!active) return;                       // §2: gate unrelated servers
        final String msg = raw;
        parseWorker.execute(() -> {                // §36: off render thread
            try {
                String norm = MessageNormalizer.normalize(msg);
                if (norm.isEmpty()) return;
                String ts = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
                ParserContext ctx = new ParserContext(
                        localPlayer, msg, serverAddress, "donutsmp", ts);
                Optional<TransactionRecord> r = ParserRegistry.parse(norm, ctx);
                if (r.isPresent()) {
                    TransactionRecord t = r.get();
                    t.server = "donutsmp";
                    t.server_address = serverAddress;
                    t.created_at = java.time.Instant.now().toString();
                    t.fingerprint = Fingerprint.of(t);
                    queue.enqueue(gson.toJson(t)); // §31/§32: durable first
                    if (cache.size() >= 500) { synchronized (cache) { cache.removeLast(); } }
                    cache.addFirst(t);
                    DonutTrackerClient.LOGGER.info("[TransactionTracker] Detected {} transaction",
                            t.transaction_type);
                } else if (config.debugLogging) {   // §38: debug only, never a fake record
                    Files.createDirectories(Path.of("logs"));
                    Files.writeString(Path.of("logs", "parser-debug.log"),
                            ts + "  " + norm + System.lineSeparator(),
                            java.nio.file.StandardOpenOption.CREATE,
                            java.nio.file.StandardOpenOption.APPEND);
                    DonutTrackerClient.LOGGER.info("[TransactionTracker] Unknown transaction message: {}", norm);
                }
            } catch (Exception e) {
                DonutTrackerClient.LOGGER.error("[TransactionTracker] parse error", e);
            }
        });
    }

    public boolean isActive() { return active; }
    public String serverAddress() { return serverAddress; }
    public int queueSize() { return queue.size(); }
    public int localCount() { return cache.size(); }
    public List<TransactionRecord> recent(int max) {
        List<TransactionRecord> out = new ArrayList<>();
        for (TransactionRecord t : cache) { out.add(t); if (out.size() >= max) break; }
        return out;
    }
}
