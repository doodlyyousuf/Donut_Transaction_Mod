package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class ListingParser implements MessageParser {
    // "You listed 7 Emerald for $ 39K"
    // "RealSwitchy listed 64 Dried Kelp Block for $ 59K"
    private static final Pattern P = Pattern.compile(
            "^(?<owner>You|[A-Za-z0-9_]{1,16})\\s+listed\\s+(?<qty>[\\d,]+)\\s+(?<item>.+?)\\s+for\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String ownerRaw = m.group("owner");
        boolean local = ownerRaw.equalsIgnoreCase("You");
        String owner = local ? ctx.localPlayer() : ownerRaw;

        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "LIST";
        t.source = "CHAT";
        t.transaction_owner = owner;             // §10/§11: never reassign to local
        t.observed_by = ctx.localPlayer();
        t.seller_username = owner;               // listing seller = lister; buyer unknown
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.item_name = m.group("item").trim();
        t.total_price = MoneyUtil.parse(m.group("price"));
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null && t.quantity != null;
        return Optional.of(t);
    }
}
