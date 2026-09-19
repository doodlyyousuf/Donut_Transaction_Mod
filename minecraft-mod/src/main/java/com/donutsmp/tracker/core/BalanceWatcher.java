package com.donutsmp.tracker.core;

import com.donutsmp.tracker.parser.BalanceParser;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.LongSupplier;

/**
 * Decides whether an incoming balance line should be hidden from chat.
 *
 * <p>The mod fires its own {@code /bal} after transactions; those replies would
 * otherwise clutter chat, so they are suppressed. Anything the player typed
 * themselves must stay visible. Replies look identical on the wire, so pending
 * checks are tracked in a FIFO in the order the commands were sent: every
 * balance command (auto or manual) queues one expectation, and each balance
 * line consumes the oldest live one. Auto expectations hide the line, manual
 * ones show it. Expectations expire so a reply that never arrives cannot
 * silence a later manual balance.
 */
public final class BalanceWatcher {
    static final long DEFAULT_EXPIRY_MS = 5_000L;
    private static final int MAX_PENDING = 16;

    private static final class Expect {
        final boolean hide;
        final long at;
        Expect(boolean hide, long at) { this.hide = hide; this.at = at; }
    }

    private final Deque<Expect> pending = new ArrayDeque<>();
    private final long expiryMs;
    private final LongSupplier clock;

    public BalanceWatcher() {
        this(DEFAULT_EXPIRY_MS, System::currentTimeMillis);
    }

    BalanceWatcher(long expiryMs, LongSupplier clock) {
        this.expiryMs = expiryMs;
        this.clock = clock;
    }

    /** A balance check was sent by the mod: hide its reply. */
    public synchronized void expectAuto() { add(true); }

    /** The player ran {@code /bal} or {@code /balance}: keep its reply visible. */
    public synchronized void expectManual() { add(false); }

    private void add(boolean hide) {
        pending.addLast(new Expect(hide, clock.getAsLong()));
        while (pending.size() > MAX_PENDING) pending.removeFirst();
    }

    /**
     * @return true when the line is a mod-triggered balance reply that must be
     *         hidden. Non-balance lines are never consumed, so unrelated chat
     *         (and other players' balances) passes straight through.
     */
    public synchronized boolean shouldSuppress(String normalized) {
        if (!BalanceParser.matchesLocalBalance(normalized)) return false;
        prune();
        Expect e = pending.pollFirst();
        return e != null && e.hide;
    }

    private void prune() {
        long now = clock.getAsLong();
        while (!pending.isEmpty() && now - pending.peekFirst().at > expiryMs) {
            pending.removeFirst();
        }
    }

    /** Test hook. */
    synchronized int pendingCount() { return pending.size(); }
}
