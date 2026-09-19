package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class OrderCreatedParser implements MessageParser {
    // "You ordered 1K Emeralds"
    private static final Pattern P = Pattern.compile(
            "^You ordered (?<qty>[\\d.,]+[KMB]?)\\s+(?<item>.+?)\\s*$", Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "ORDER_CREATED";
        t.source = "ORDER";
        t.status = "PENDING";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.buyer_username = ctx.localPlayer();
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.item_name = m.group("item").trim();
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.quantity != null;
        return Optional.of(t);
    }
}
