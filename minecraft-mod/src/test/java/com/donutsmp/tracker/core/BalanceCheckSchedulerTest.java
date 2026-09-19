package com.donutsmp.tracker.core;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BalanceCheckSchedulerTest {

    @Test void disabledNeverFires() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(false, 0, 0);
        assertFalse(s.tick(1_000, true));
    }

    @Test void firesAfterATransaction() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 15_000, 0);
        assertTrue(s.tick(1_000, true));
    }

    @Test void noTransactionNoCheck() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 15_000, 0);
        assertFalse(s.tick(1_000, false));
        assertFalse(s.tick(60_000, false));
    }

    @Test void burstIsThrottledToTheCooldown() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 15_000, 0);
        assertTrue(s.tick(1_000, true));
        assertFalse(s.tick(5_000, true));    // within cooldown
        assertFalse(s.tick(15_999, true));
        assertTrue(s.tick(16_000, true));    // cooldown elapsed
    }

    @Test void periodicCheckFiresWithoutTransactions() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 0, 10);
        assertFalse(s.tick(1_000, false));   // arms the period
        assertFalse(s.tick(10_999, false));
        assertTrue(s.tick(11_000, false));
    }

    @Test void periodicRespectsCooldown() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 15_000, 10);
        assertTrue(s.tick(1_000, true));     // transaction-triggered now
        assertFalse(s.tick(11_000, false));  // cooldown not elapsed; arms the period
        assertFalse(s.tick(16_000, false));  // cooled, but the period is not due yet
        assertTrue(s.tick(22_000, false));   // period elapsed
    }

    @Test void resetClearsTiming() {
        BalanceCheckScheduler s = new BalanceCheckScheduler(true, 15_000, 0);
        assertTrue(s.tick(1_000, true));
        s.reset();
        assertTrue(s.tick(1_100, true));
    }
}
