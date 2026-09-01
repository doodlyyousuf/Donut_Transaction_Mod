package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class BuyParser implements MessageParser {
    // "You bought 1 Ominous Trial Key for $ 440K"
    private static final Pattern P = Pattern.compile(
            "^you\\s+bought\\s+(?<qty>[\\d,]+)\\s+(?<item>.+?)\\s+for\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "BUY";
        t.source = "CHAT";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.buyer_username = ctx.localPlayer();   // §10: seller is UNKNOWN → null
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.item_name = m.group("item").trim();
        t.total_price = MoneyUtil.parse(m.group("price"));
        t.money_paid = t.total_price;
        t.money_received = "0";
        t.net_amount = t.total_price == null ? null : "-" + t.total_price;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null && t.quantity != null;
        return Optional.of(t);
    }
}
