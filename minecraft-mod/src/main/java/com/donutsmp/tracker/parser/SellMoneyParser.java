package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class SellMoneyParser implements MessageParser {
    // "$ 63.7K"  (standalone /sell payout)
    private static final Pattern P = Pattern.compile(
            "^\\$\\s*(?<amount>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$");

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String amount = MoneyUtil.parse(m.group("amount"));
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "SELL";
        t.source = "SELL_COMMAND";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.seller_username = ctx.localPlayer();
        t.money_received = amount;
        t.money_paid = "0";
        t.net_amount = amount;
        t.item_name = null;   // §41: DO NOT invent
        t.quantity = null;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = amount != null;
        return Optional.of(t);
    }
}
