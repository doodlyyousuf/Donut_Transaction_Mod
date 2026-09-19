package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class DeliverySummaryParser implements MessageParser {
    // "Players delivered you 4"   (deliverer and item unknowable → §41)
    private static final Pattern P = Pattern.compile(
            "^players\\s+delivered\\s+you\\s+(?<qty>[\\d,]+)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "ORDER_DELIVERY";
        t.source = "ORDER_DELIVERY";
        t.status = "COMPLETED";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.recipient_username = ctx.localPlayer();
        t.buyer_username = ctx.localPlayer();
        t.seller_username = null;                // §41: deliverer not stated
        t.item_name = null;                      // §41: never invent
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.money_paid = t.money_received = t.total_price = null;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.quantity != null;
        return Optional.of(t);
    }
}
