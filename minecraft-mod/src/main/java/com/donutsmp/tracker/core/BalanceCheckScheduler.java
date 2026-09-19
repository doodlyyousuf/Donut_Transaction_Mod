package com.donutsmp.tracker.core;

/**
 * Decides when the mod should fire its own balance check. A check is triggered
 * after a transaction, throttled by a cooldown so a burst of activity only
 * produces one command, and optionally on a fixed period as a safety net.
 *
 * <p>Timing and configuration are injected, so the behaviour is deterministic
 * in tests and independent of Minecraft classes.
 */
public final class BalanceCheckScheduler {
    private boolean enabled;
    private long cooldownMs;
    private int periodicSeconds;
    private long lastCheckMillis;
    private long nextPeriodicMillis;

    public BalanceCheckScheduler(boolean enabled, long cooldownMs, int periodicSeconds) {
        update(enabled, cooldownMs, periodicSeconds);
    }

    public void update(boolean enabled, long cooldownMs, int periodicSeconds) {
        this.enabled = enabled;
        this.cooldownMs = Math.max(0, cooldownMs);
        this.periodicSeconds = Math.max(0, periodicSeconds);
    }

    /**
     * @param nowMillis          current wall clock
     * @param transactionPending a transaction has happened since the last check
     * @return true when a balance command should be sent on this tick
     */
    public boolean tick(long nowMillis, boolean transactionPending) {
        if (!enabled) return false;

        boolean cooled = lastCheckMillis == 0 || nowMillis - lastCheckMillis >= cooldownMs;
        boolean due = false;

        if (transactionPending && cooled) {
            due = true;
        }

        if (!due && periodicSeconds > 0) {
            if (nextPeriodicMillis == 0) {
                nextPeriodicMillis = nowMillis + periodicSeconds * 1000L;
            } else if (nowMillis >= nextPeriodicMillis && cooled) {
                nextPeriodicMillis = nowMillis + periodicSeconds * 1000L;
                due = true;
            }
        }

        if (due) lastCheckMillis = nowMillis;
        return due;
    }

    /** Forget timing state, e.g. when switching servers. */
    public void reset() {
        lastCheckMillis = 0;
        nextPeriodicMillis = 0;
    }

    public long lastCheckMillis() { return lastCheckMillis; }
}
