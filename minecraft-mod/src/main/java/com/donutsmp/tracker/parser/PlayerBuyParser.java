package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class PlayerBuyParser implements MessageParser {
    // "qzweel_ bought 1 Soul Sand for $ 1K"   (another player, observed)
    private static final Pattern P = Pattern.compile(
            "^(?!you\\b)(?<buyer>[A-Za-z0-9_]{1,16})\\s+bought\\s+(?<qty>[\\d,]+)\\s+(?<item>.+?)\\s+for\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String buyer = m.group("buyer");
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "BUY";
        t.source = "CHAT";
        t.transaction_owner = buyer;             // §10/§11: observed player, never local
        t.observed_by = ctx.localPlayer();
        t.buyer_username = buyer;
        t.seller_username = null;                // §41: seller not stated
        t.quantity = QtyUtil.parse(m.group("qty"));
        t.item_name = m.group("item").trim();
        t.total_price = MoneyUtil.parse(m.group("price"));
        t.money_paid = null;                     // §10: not the local player's cash flow
        t.money_received = null;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null && t.quantity != null;
        return Optional.of(t);
    }
}
