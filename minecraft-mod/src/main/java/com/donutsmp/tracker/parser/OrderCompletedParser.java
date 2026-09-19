package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class OrderCompletedParser implements MessageParser {
    // "Your Emerald order is complete!"
    private static final Pattern P = Pattern.compile(
            "^Your (?<item>.+?) order is complete!?\\s*$", Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "ORDER_COMPLETED";
        t.source = "ORDER";
        t.status = "COMPLETED";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.buyer_username = ctx.localPlayer();
        t.item_name = m.group("item").trim();
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = true;
        return Optional.of(t);
    }
}
