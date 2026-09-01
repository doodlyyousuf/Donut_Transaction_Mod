package com.donutsmp.tracker;

import com.donutsmp.tracker.model.*;
import com.donutsmp.tracker.parser.*;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class ParserTest {
    private static final ParserContext CTX =
            new ParserContext("Doodly_yousuf", "", "asia.donutsmp.net", "donutsmp", "13:00:00");

    private static TransactionRecord parse(String msg) {
        String norm = MessageNormalizer.normalize(msg);
        Optional<TransactionRecord> r = ParserRegistry.parse(norm, CTX);
        assertTrue(r.isPresent(), "no parser matched: " + msg);
        return r.get();
    }

    @Test void test1_localListing() {   // "You listed 7 Emerald for $ 39K"
        TransactionRecord t = parse("You listed 7 Emerald for $ 39K");
        assertEquals("LIST", t.transaction_type);
        assertEquals("Emerald", t.item_name);
        assertEquals(7L, t.quantity);
        assertEquals("39000", t.total_price);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.observed_by);
    }

    @Test void test2_localBuy() {       // "You bought 1 Ominous Trial Key for $ 440K"
        TransactionRecord t = parse("You bought 1 Ominous Trial Key for $ 440K");
        assertEquals("BUY", t.transaction_type);
        assertEquals("Ominous Trial Key", t.item_name);
        assertEquals(1L, t.quantity);
        assertEquals("440000", t.total_price);
        assertEquals("440000", t.money_paid);
        assertEquals("0", t.money_received);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.buyer_username);
        assertNull(t.seller_username);   // §41: no seller in message
    }

    @Test void test3_observedListing() { // "RealSwitchy listed 64 Dried Kelp Block for $ 59K"
        TransactionRecord t = parse("RealSwitchy listed 64 Dried Kelp Block for $ 59K");
        assertEquals("LIST", t.transaction_type);
        assertEquals("RealSwitchy", t.transaction_owner);   // NOT local player
        assertEquals("Doodly_yousuf", t.observed_by);
        assertEquals("Dried Kelp Block", t.item_name);
        assertEquals(64L, t.quantity);
        assertEquals("59000", t.total_price);
    }

    @Test void test4_sellCommandMoney() { // "$ 63.7K"
        TransactionRecord t = parse("$ 63.7K");
        assertEquals("SELL", t.transaction_type);
        assertEquals("SELL_COMMAND", t.source);
        assertEquals("63700", t.money_received);
        assertNull(t.item_name);   // §41: never invent
        assertNull(t.quantity);
        assertTrue(t.parsed_successfully);
    }

    @Test void test5_orderDelivery() {   // "Jonas1138 delivered you 2 Diamond Boots"
        TransactionRecord t = parse("Jonas1138 delivered you 2 Diamond Boots");
        assertEquals("ORDER_DELIVERY", t.transaction_type);
        assertEquals("Jonas1138", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.recipient_username);
        assertEquals("Diamond Boots", t.item_name);
        assertEquals(2L, t.quantity);
        assertEquals("COMPLETED", t.status);
        assertNull(t.total_price);       // no price in message
    }

    @Test void rawLogPrefixIsStripped() {  // §8
        TransactionRecord t = parse(
            "[13:42:44] [Render thread/INFO]: [CHAT] RealSwitchy listed 64 Dried Kelp Block for $ 59K");
        assertEquals("RealSwitchy", t.transaction_owner);
        assertEquals("59000", t.total_price);
    }

    @Test void caseInsensitive() {
        assertEquals("BUY", parse("you BOUGHT 1 Emerald FOR $ 500").transaction_type);
        assertEquals("LIST", parse("realswitchy LISTED 64 kelp for $ 1K").transaction_type);
    }

    @Test void bigQuantityPastStackLimit() {   // §14
        TransactionRecord t = parse("You bought 10000 Cobblestone for $ 10,000");
        assertEquals(10000L, t.quantity);
        assertEquals("10000", t.total_price);
    }

    @Test void unknownMessageIsNotATransaction() {
        assertTrue(ParserRegistry.parse("Steve joined the game", CTX).isEmpty());
        assertTrue(ParserRegistry.parse("hello everyone", CTX).isEmpty());
    }

    @Test void malformedPriceKeepsRecordButFlagged() {
        TransactionRecord t = parse("You bought 1 Emerald for $ bananas");
        assertEquals("BUY", t.transaction_type);
        assertNull(t.total_price);
        assertFalse(t.parsed_successfully);
    }

    @Test void duplicateRawMessagesProduceIdenticalFingerprints() {  // §19
        TransactionRecord a = parse("RealSwitchy listed 64 Dried Kelp Block for $ 59K");
        TransactionRecord b = parse("RealSwitchy listed 64 Dried Kelp Block for $ 59K");
        a.server = b.server = "donutsmp";
        a.minecraft_timestamp = b.minecraft_timestamp;
        assertEquals(com.donutsmp.tracker.core.Fingerprint.of(a),
                     com.donutsmp.tracker.core.Fingerprint.of(b));
    }
}
