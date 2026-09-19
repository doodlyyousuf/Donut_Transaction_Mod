package com.donutsmp.tracker.core;

import org.junit.jupiter.api.Test;

import java.util.function.LongSupplier;

import static org.junit.jupiter.api.Assertions.*;

class BalanceWatcherTest {
    private long now = 0;
    private final LongSupplier clock = () -> now;
    private final BalanceWatcher watcher = new BalanceWatcher(5_000L, clock);

    @Test void autoReplyIsHidden() {
        watcher.expectAuto();
        assertTrue(watcher.shouldSuppress("You have $ 313,162,724"));
    }

    @Test void manualReplyIsShown() {
        watcher.expectManual();
        assertFalse(watcher.shouldSuppress("You have $ 313,162,724"));
    }

    @Test void unsolicitedBalanceIsShown() {
        assertFalse(watcher.shouldSuppress("$100,982,091"));
    }

    @Test void nonBalanceLineIsNotConsumed() {
        watcher.expectAuto();
        assertFalse(watcher.shouldSuppress("F18 sold 1 Diamond for $ 39K"));
        assertTrue(watcher.shouldSuppress("You have $ 1,000"));
    }

    @Test void otherPlayersBalanceIsNeverSuppressed() {
        watcher.expectAuto();
        assertFalse(watcher.shouldSuppress("F18 has $ 105K"));
        assertTrue(watcher.shouldSuppress("You have $ 1,000"));
    }

    @Test void repliesAreMatchedInSendOrder() {
        watcher.expectAuto();      // mod's check, sent first
        watcher.expectManual();    // player's check, sent second
        assertTrue(watcher.shouldSuppress("You have $ 10"));    // mod's reply
        assertFalse(watcher.shouldSuppress("You have $ 10"));   // player's reply
    }

    @Test void missingReplyExpires() {
        watcher.expectAuto();
        now = 6_000;
        assertFalse(watcher.shouldSuppress("You have $ 10"));
        assertEquals(0, watcher.pendingCount());
    }

    @Test void manyAutoChecksKeepTheMostRecent() {
        for (int i = 0; i < 30; i++) watcher.expectAuto();
        assertTrue(watcher.pendingCount() <= 16);
    }
}
