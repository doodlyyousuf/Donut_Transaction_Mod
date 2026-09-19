package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class KillRewardParser implements MessageParser {
    // "+$17.8M for killing Doodly_yousuf"
    private static final Pattern P = Pattern.compile(
            "^\\+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s+for\\s+killing\\s+(?<victim>[A-Za-z0-9_]{1,16})\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "PAYMENT_RECEIVED";   // the killer (local) received the reward
        t.source = "CHAT";
        t.status = "COMPLETED";
        t.transaction_owner = ctx.localPlayer();
        t.observed_by = ctx.localPlayer();
        t.recipient_username = ctx.localPlayer();
        t.buyer_username = null;
        t.seller_username = null;
        t.item_name = null;                        // §41: victim name lives in raw_message
        t.quantity = null;
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
