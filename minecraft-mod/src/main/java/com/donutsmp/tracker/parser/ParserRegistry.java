package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.*;

public final class ParserRegistry {
    // Order matters: first match wins. Add new parsers here (§40).
    private static final List<MessageParser> PARSERS = List.of(
            new BalanceParser(),            // "$100,982,091" / "You have $..." / "X has $ ..."
            new SellMoneyParser(),          // cheap, very specific "$ 63.7K"
            new BuyParser(),                // local "You bought ..."
            new SaleParser(),               // local listing sold: "X bought your ..."
            new ListingParser(),            // local AND observed "listed ..."
            new AuctionEarningsParser(),    // local "You earned $... from auction"
            new OrderCreatedParser(),       // local "You ordered 1K Emeralds"
            new OrderCompletedParser(),     // local "Your Emerald order is complete!"
            new PlayerBuyParser(),          // observed "X bought N item for $..."
            new PlayerSellMultipleParser(), // observed "X sold multiple items for $..."
            new DeliveryParser(),           // "X delivered you N item ..."
            new DeliverySummaryParser(),    // "Players delivered you N"
            new PaymentParser(),            // "X was paid $P by Y"
            new PaymentActiveParser(),      // "X paid Y $P" / "X paid you $P"
            new BountyParser(),             // "X added $P to your bounty"
            new KillRewardParser());        // "+$P for killing X"

    /**
     * Parse one normalized chat line into zero, one, or two records.
     *
     * Most messages yield a single record. A payment names two players, and the
     * ledger aggregates per {@code transaction_owner}, so it is expanded into a
     * double entry: the payer's outflow plus a mirrored inflow for the payee.
     * That keeps both observed players' totals correct and conserves money
     * globally.
     */
    public static List<TransactionRecord> parse(String normalized, ParserContext ctx) {
        for (MessageParser p : PARSERS) {
            Optional<TransactionRecord> r = p.tryParse(normalized, ctx);
            if (r.isPresent()) {
                TransactionRecord primary = r.get();
                TransactionRecord mirror = mirrorPayment(primary);
                if (mirror == null) return List.of(primary);
                return List.of(primary, mirror);
            }
        }
        return List.of();
    }

    /** The other side of a payment, or null when there is no distinct counterparty. */
    private static TransactionRecord mirrorPayment(TransactionRecord t) {
        String type = t.transaction_type;
        if (!"PAYMENT_SENT".equals(type) && !"PAYMENT_RECEIVED".equals(type)) return null;
        if (t.total_price == null) return null;

        String owner = t.transaction_owner;
        String payer = t.buyer_username;
        String payee = t.recipient_username;
        if (owner == null || payer == null || payee == null) return null;

        String counterparty;
        if (owner.equalsIgnoreCase(payer)) counterparty = payee;
        else if (owner.equalsIgnoreCase(payee)) counterparty = payer;
        else return null;
        if (counterparty.isBlank() || counterparty.equalsIgnoreCase(owner)) return null;

        TransactionRecord m = new TransactionRecord();
        m.source = "CHAT_MIRROR";          // derived ledger entry, not a second observation
        m.status = "COMPLETED";
        m.observed_by = t.observed_by;
        m.buyer_username = payer;
        m.recipient_username = payee;
        m.seller_username = null;
        m.item_name = null;
        m.quantity = null;
        m.total_price = t.total_price;
        m.raw_message = t.raw_message;
        m.normalized_message = t.normalized_message;
        m.minecraft_timestamp = t.minecraft_timestamp;
        m.parsed_successfully = true;
        m.transaction_owner = counterparty;

        if (owner.equalsIgnoreCase(payer)) {
            m.transaction_type = "PAYMENT_RECEIVED";
            m.money_received = t.total_price;
            m.money_paid = "0";
            m.net_amount = t.total_price;
        } else {
            m.transaction_type = "PAYMENT_SENT";
            m.money_paid = t.total_price;
            m.money_received = "0";
            m.net_amount = "-" + t.total_price;
        }
        return m;
    }
}
