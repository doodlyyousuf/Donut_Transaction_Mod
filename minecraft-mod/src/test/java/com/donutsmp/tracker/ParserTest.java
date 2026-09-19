package com.donutsmp.tracker;

import com.donutsmp.tracker.model.*;
import com.donutsmp.tracker.parser.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ParserTest {
    private static final ParserContext CTX =
            new ParserContext("Doodly_yousuf", "", "asia.donutsmp.net", "donutsmp", "13:00:00");

    private static List<TransactionRecord> parseAll(String msg) {
        String norm = MessageNormalizer.normalize(msg);
        List<TransactionRecord> r = ParserRegistry.parse(norm, CTX);
        assertFalse(r.isEmpty(), "no parser matched: " + msg);
        return r;
    }

    private static TransactionRecord parse(String msg) {
        return parseAll(msg).get(0);
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

    @Test void test6_localListingSold() {   // "P5Games1 bought your Mace for $7.7M"
        TransactionRecord t = parse("P5Games1 bought your Mace for $7.7M");
        assertEquals("SELL", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.seller_username);
        assertEquals("P5Games1", t.buyer_username);
        assertEquals("Mace", t.item_name);
        assertEquals("7700000", t.total_price);
        assertEquals("7700000", t.money_received);
        assertNull(t.quantity);   // §41: qty not stated
        assertTrue(t.parsed_successfully);
    }

    @Test void test7_localListingSoldSpaceBeforePrice() {
        TransactionRecord t = parse("Visiblestalk bought your Emerald for $188K");
        assertEquals("SELL", t.transaction_type);
        assertEquals("188000", t.total_price);
        assertEquals("Doodly_yousuf", t.transaction_owner);
    }

    @Test void test7b_localListingSoldWhileAway() {
        TransactionRecord t = parse("ajax200 bought your Shard Pickaxe for $18.2M while you were away");
        assertEquals("SELL", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("ajax200", t.buyer_username);
        assertEquals("Shard Pickaxe", t.item_name);
        assertEquals("18200000", t.money_received);
        assertTrue(t.parsed_successfully);
    }

    @Test void test8_observedPlayerBuy() {   // "qzweel_ bought 1 Soul Sand for $ 1K"
        TransactionRecord t = parse("qzweel_ bought 1 Soul Sand for $ 1K");
        assertEquals("BUY", t.transaction_type);
        assertEquals("qzweel_", t.transaction_owner);   // NOT local player
        assertEquals("qzweel_", t.buyer_username);
        assertEquals("Doodly_yousuf", t.observed_by);
        assertNull(t.seller_username);                  // §41: unknown
        assertEquals("Soul Sand", t.item_name);
        assertEquals(1L, t.quantity);
        assertEquals("1000", t.total_price);
        assertNull(t.money_paid);                       // §10: not local cash flow
        assertNull(t.money_received);
    }

    @Test void test9_observedPlayerBuyPluralItem() {
        TransactionRecord t = parse("SideWayzzzz bought 16 Ender Pearls for $ 3.4K");
        assertEquals("BUY", t.transaction_type);
        assertEquals("SideWayzzzz", t.transaction_owner);
        assertEquals("Ender Pearls", t.item_name);
        assertEquals(16L, t.quantity);
        assertEquals("3400", t.total_price);
    }

    @Test void test10_observedPlayerSellMultiple() {
        TransactionRecord t = parse("SideWayzzzz sold multiple items for $ 2.5K");
        assertEquals("SELL", t.transaction_type);
        assertEquals("SideWayzzzz", t.transaction_owner);
        assertNull(t.item_name);      // §5/§41: never invent
        assertNull(t.quantity);
        assertEquals("2500", t.total_price);
        // Selling earns the owner the sale price, even when observed on someone else.
        assertEquals("2500", t.money_received);
        assertEquals("0", t.money_paid);
        assertEquals("2500", t.net_amount);
    }

    @Test void test11_auctionEarnings() {
        TransactionRecord t = parse("You earned $345K from auction");
        assertEquals("SELL", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("345000", t.money_received);
        assertEquals("345000", t.total_price);
        assertNull(t.item_name);   // §41
        assertNull(t.quantity);
        assertTrue(t.parsed_successfully);
    }

    @Test void test12_auctionEarningsWithDelivery() {
        TransactionRecord t = parse("You earned $345K from auction got delivered 2 items");
        assertEquals("SELL", t.transaction_type);
        assertEquals("345000", t.money_received);
        assertNull(t.quantity);   // §41: delivery count is not the sold quantity
    }

    @Test void test13_deliveryWhileAwayAndDotPrefix() {
        TransactionRecord t = parse(".Midsann delivered you 1 Diamond Boots while you were away");
        assertEquals("ORDER_DELIVERY", t.transaction_type);
        assertEquals("Midsann", t.transaction_owner);   // leading "." stripped
        assertEquals("Diamond Boots", t.item_name);
        assertEquals(1L, t.quantity);
    }

    @Test void test14_deliverySummary() {
        TransactionRecord t = parse("Players delivered you 4");
        assertEquals("ORDER_DELIVERY", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.recipient_username);
        assertNull(t.item_name);   // §41
        assertNull(t.seller_username);
        assertEquals(4L, t.quantity);
    }

    @Test void test15_leadingDotPrefixStripped() {
        assertEquals("Midsann delivered you 1 Diamond Boots",
                MessageNormalizer.normalize(".Midsann delivered you 1 Diamond Boots"));
        assertEquals("Doodly_yousuf was killed!",
                MessageNormalizer.normalize("Doodly_yousuf was killed!"));
    }

    @Test void test16_observedPayment() {   // "SideWayzzzz was paid $ 25M by Schtiev123"
        List<TransactionRecord> all = parseAll("SideWayzzzz was paid $ 25M by Schtiev123");
        assertEquals(2, all.size());                        // payer outflow + payee inflow
        TransactionRecord t = all.get(0);
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("Schtiev123", t.transaction_owner);   // the payer performed it
        assertEquals("SideWayzzzz", t.recipient_username);
        assertEquals("Schtiev123", t.buyer_username);
        assertEquals("25000000", t.total_price);
        assertEquals("25000000", t.money_paid);            // observed payer's outflow is real
        assertEquals("0", t.money_received);
        TransactionRecord m = all.get(1);
        assertEquals("PAYMENT_RECEIVED", m.transaction_type);
        assertEquals("SideWayzzzz", m.transaction_owner);  // payee gets the inflow
        assertEquals("25000000", m.money_received);
        assertEquals("CHAT_MIRROR", m.source);
    }

    @Test void test17_localPaymentReceived() {
        TransactionRecord t = parse("You were paid $ 60K by Eidunas");
        assertEquals("PAYMENT_RECEIVED", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("60000", t.money_received);
        assertEquals("60000", t.net_amount);
        assertNull(t.item_name);
    }

    @Test void test18_localPaymentSent() {
        TransactionRecord t = parse("Steve was paid $ 60K by You");
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("60000", t.money_paid);
        assertEquals("-60000", t.net_amount);
        assertEquals("Steve", t.recipient_username);
    }

    @Test void test18b_activeLocalPaymentSent() {
        TransactionRecord t = parse("You paid True_Horror $ 100K");
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("100000", t.money_paid);
        assertEquals("0", t.money_received);
        assertEquals("-100000", t.net_amount);
        assertEquals("Doodly_yousuf", t.buyer_username);   // payer
        assertEquals("True_Horror", t.recipient_username); // payee
    }

    @Test void test18c_activeLocalPaymentReceived() {
        TransactionRecord t = parse("Ryuu_3103 paid you $ 200M");
        assertEquals("PAYMENT_RECEIVED", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("200000000", t.money_received);
        assertEquals("0", t.money_paid);
        assertEquals("Ryuu_3103", t.buyer_username);       // payer
        assertEquals("Doodly_yousuf", t.recipient_username);
    }

    @Test void test18d_activeObservedPayment() {
        List<TransactionRecord> all = parseAll("True_Horror paid Alsojettism $ 200K");
        assertEquals(2, all.size());
        TransactionRecord t = all.get(0);
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("True_Horror", t.transaction_owner);  // the payer performed it
        assertEquals("Alsojettism", t.recipient_username);
        assertEquals("200000", t.total_price);
        assertEquals("200000", t.money_paid);              // payer's outflow recorded
        assertEquals("0", t.money_received);
        TransactionRecord m = all.get(1);
        assertEquals("PAYMENT_RECEIVED", m.transaction_type);
        assertEquals("Alsojettism", m.transaction_owner);
        assertEquals("200000", m.money_received);
        assertEquals("0", m.money_paid);
    }

    @Test void test18f_localPaymentMirrorsCounterparty() {
        // Local inflow also credits the payer's outflow as a second ledger entry.
        List<TransactionRecord> in = parseAll("You were paid $ 60K by Eidunas");
        assertEquals(2, in.size());
        assertEquals("PAYMENT_RECEIVED", in.get(0).transaction_type);
        assertEquals("Doodly_yousuf", in.get(0).transaction_owner);
        assertEquals("Eidunas", in.get(1).transaction_owner);
        assertEquals("PAYMENT_SENT", in.get(1).transaction_type);
        assertEquals("60000", in.get(1).money_paid);

        // Local outflow credits the payee's inflow.
        List<TransactionRecord> out = parseAll("Steve was paid $ 60K by You");
        assertEquals(2, out.size());
        assertEquals("PAYMENT_SENT", out.get(0).transaction_type);
        assertEquals("Doodly_yousuf", out.get(0).transaction_owner);
        assertEquals("Steve", out.get(1).transaction_owner);
        assertEquals("60000", out.get(1).money_received);
    }

    @Test void test18e_passivePaymentFromDottedAccount() {
        TransactionRecord t = parse("True_Horror was paid $ 100K by .RLEIO4566");
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals(".RLEIO4566", t.transaction_owner);   // dotted name preserved verbatim
        assertEquals("True_Horror", t.recipient_username);
        assertEquals("100000", t.total_price);
    }

    @Test void test19_bountyAddedByLocal() {
        TransactionRecord t = parse("You added $ 10M to Doodly_yousuf's bounty");
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.recipient_username);
        assertEquals("10000000", t.money_paid);
        assertEquals("-10000000", t.net_amount);
    }

    @Test void test20_bountyAddedByOther() {
        TransactionRecord t = parse("SideWayzzzz added $7.8M to your bounty.");
        assertEquals("PAYMENT_SENT", t.transaction_type);
        assertEquals("SideWayzzzz", t.transaction_owner);     // observed actor, not local
        assertEquals("Doodly_yousuf", t.recipient_username);  // target resolved to local
        assertEquals("7800000", t.total_price);
        assertNull(t.money_paid);                             // §10
    }

    @Test void test21_killReward() {
        TransactionRecord t = parse("+$17.8M for killing Doodly_yousuf");
        assertEquals("PAYMENT_RECEIVED", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("17800000", t.money_received);
        assertTrue(t.parsed_successfully);
    }

    @Test void test22_orderCreated() {  // "You ordered 1K Emeralds"
        TransactionRecord t = parse("You ordered 1K Emeralds");
        assertEquals("ORDER_CREATED", t.transaction_type);
        assertEquals("Emeralds", t.item_name);
        assertEquals(1000L, t.quantity);          // "1K" expanded, not left unknown
        assertEquals("PENDING", t.status);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.buyer_username);
        assertNull(t.total_price);                // §41: no price in message
    }

    @Test void test23_orderCompleted() {  // "Your Emerald order is complete!"
        TransactionRecord t = parse("Your Emerald order is complete!");
        assertEquals("ORDER_COMPLETED", t.transaction_type);
        assertEquals("Emerald", t.item_name);
        assertEquals("COMPLETED", t.status);
        assertEquals("Doodly_yousuf", t.transaction_owner);
        assertEquals("Doodly_yousuf", t.buyer_username);
        assertNull(t.total_price);
    }

    @Test void test24_localBalance() {  // "$100,982,091"
        TransactionRecord t = parse("$100,982,091");
        assertEquals("BALANCE", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);   // local player
        assertEquals("100982091", t.total_price);
        assertNull(t.money_received);                         // §41: not income
        assertNull(t.money_paid);
        assertNull(t.item_name);
    }

    @Test void test24b_localBalanceYouHave() {  // "You have $ 313,162,724"
        TransactionRecord t = parse("You have $ 313,162,724");
        assertEquals("BALANCE", t.transaction_type);
        assertEquals("Doodly_yousuf", t.transaction_owner);   // local player
        assertEquals("313162724", t.total_price);
        assertNull(t.money_received);                         // §41: not income
        assertNull(t.money_paid);
    }

    @Test void test25_otherPlayerBalance() {  // "F18 has $ 105K"
        TransactionRecord t = parse("F18 has $ 105K");
        assertEquals("BALANCE", t.transaction_type);
        assertEquals("F18", t.transaction_owner);
        assertEquals("105000", t.total_price);
        assertNull(t.money_received);
    }

    @Test void test26_sellPayoutStillNotABalance() {  // "$ 63.7K" keeps §5 meaning
        TransactionRecord t = parse("$ 63.7K");
        assertEquals("SELL", t.transaction_type);
        assertEquals("63700", t.money_received);
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
