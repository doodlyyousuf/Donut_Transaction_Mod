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
    /** Set when a non-balance transaction is seen, so the client can run /bal. */
    private final java.util.concurrent.atomic.AtomicBoolean balanceCheckPending =
            new java.util.concurrent.atomic.AtomicBoolean(false);

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
        this.balanceCheckPending.set(false);
    }

    public void onDisconnect() {
        this.active = false;
        this.balanceCheckPending.set(false);
    }

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
                List<TransactionRecord> records = ParserRegistry.parse(norm, ctx);
                if (!records.isEmpty()) {
                    boolean sawTransaction = false;
                    for (TransactionRecord t : records) {
                        t.server = "donutsmp";
                        t.server_address = serverAddress;
                        t.created_at = java.time.Instant.now().toString();
                        t.fingerprint = Fingerprint.of(t);
                        queue.enqueue(gson.toJson(t)); // §31/§32: durable first
                        if (cache.size() >= 500) { synchronized (cache) { cache.removeLast(); } }
                        cache.addFirst(t);
                        if (!"BALANCE".equals(t.transaction_type)) sawTransaction = true;
                        DonutTrackerClient.LOGGER.info("[TransactionTracker] Detected {} transaction",
                                t.transaction_type);
                    }
                    // Refresh the balance after real activity. A balance reply is
                    // deliberately excluded: it is the result of this very check, and
                    // reacting to it would loop /bal forever.
                    if (sawTransaction) balanceCheckPending.set(true);
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
    /** True when a transaction happened since the last balance check was sent. */
    public boolean isBalanceCheckPending() { return balanceCheckPending.get(); }
    public void clearBalanceCheckPending() { balanceCheckPending.set(false); }
    public String serverAddress() { return serverAddress; }
    public int queueSize() { return queue.size(); }
    public int localCount() { return cache.size(); }
    public List<TransactionRecord> recent(int max) {
        List<TransactionRecord> out = new ArrayList<>();
        for (TransactionRecord t : cache) { out.add(t); if (out.size() >= max) break; }
        return out;
    }
}
