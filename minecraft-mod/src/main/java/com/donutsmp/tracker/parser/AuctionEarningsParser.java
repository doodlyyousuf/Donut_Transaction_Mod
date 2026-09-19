package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class AuctionEarningsParser implements MessageParser {
    // "You earned $345K from auction"
    // "You earned $345K from auction got delivered 2 items"
    private static final Pattern P = Pattern.compile(
            "^you\\s+earned\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s+from\\s+auction\\b.*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "SELL";             // §5: money received, item/qty unknowable
        t.source = "CHAT";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.seller_username = ctx.localPlayer();
        t.item_name = null;                      // §41: never invent
        t.quantity = null;                       // §41: "delivered N items" is not the sold qty
        t.total_price = MoneyUtil.parse(m.group("price"));
        t.money_received = t.total_price;
        t.money_paid = "0";
        t.net_amount = t.total_price;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null;
        return Optional.of(t);
    }
}
