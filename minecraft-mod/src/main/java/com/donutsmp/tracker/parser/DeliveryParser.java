package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class DeliveryParser implements MessageParser {
    // "Jonas1138 delivered you 2 Diamond Boots"
    private static final Pattern P = Pattern.compile(
            "^(?<player>[A-Za-z0-9_]{1,16})\\s+delivered\\s+you\\s+(?<qty>[\\d,]+)\\s+(?<item>.+?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String player = m.group("player");
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "ORDER_DELIVERY";
        t.source = "ORDER_DELIVERY";
        t.status = "COMPLETED";
        t.transaction_owner = player;            // the deliverer performed it
        t.observed_by = ctx.localPlayer();
        t.seller_username = player;
        t.recipient_username = ctx.localPlayer();
        t.buyer_username = ctx.localPlayer();
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.item_name = m.group("item").trim();
        t.money_paid = t.money_received = t.total_price = null;  // §41: no price in message
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.quantity != null;
        return Optional.of(t);
    }
}
