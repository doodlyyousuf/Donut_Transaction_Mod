package com.donutsmp.tracker.queue;

import com.donutsmp.tracker.config.TrackerConfig;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

public final class OfflineQueue {
    private final Path file;

    public OfflineQueue(TrackerConfig cfg) {
        this.file = FabricLoader.getInstance().getConfigDir()
                .resolve("donutsmp-transaction-tracker")
                .resolve("queue.jsonl");
        try { Files.createDirectories(file.getParent()); }
        catch (IOException e) { throw new RuntimeException(e); }
    }

    public synchronized void enqueue(String json) {
        try {
            Files.writeString(file, json + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            throw new RuntimeException("Queue write failed", e);   // storage loss is fatal
        }
    }

    public synchronized List<String> drain(int max) {
        try {
            if (!Files.exists(file)) return List.of();
            List<String> all = Files.readAllLines(file);
            return all.subList(0, Math.min(max, all.size()));
        } catch (IOException e) { return List.of(); }
    }

    /** Remove successfully-uploaded lines; keep everything else intact. */
    public synchronized void remove(List<String> sent) {
        try {
            if (!Files.exists(file) || sent.isEmpty()) return;
            List<String> remaining = new ArrayList<>(Files.readAllLines(file));
            for (String line : sent) {
                remaining.remove(line);  // one occurrence per uploaded line
            }
            Files.write(file, remaining, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.CREATE);
        } catch (IOException e) { /* keep file; retried next cycle */ }
    }

    public synchronized int size() {
        try { return Files.exists(file) ? (int) Files.lines(file).count() : 0; }
        catch (IOException e) { return 0; }
    }
}
