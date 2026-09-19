package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class SaleParser implements MessageParser {
    // "P5Games1 bought your Mace for $7.7M"   (local listing was bought → local earned)
    // "ajax200 bought your Shard Pickaxe for $18.2M while you were away"
    private static final Pattern P = Pattern.compile(
            "^(?<buyer>[A-Za-z0-9_.]{1,16})\\s+bought\\s+your\\s+(?<item>.+?)\\s+for\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s*(?:while\\s+you\\s+were\\s+away)?\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "SELL";
        t.source = "CHAT";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.seller_username = ctx.localPlayer();
        t.buyer_username = m.group("buyer");
        t.item_name = m.group("item").trim();
        t.quantity = null;   // §41: quantity not stated in this message
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
