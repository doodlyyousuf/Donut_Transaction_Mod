package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class BountyParser implements MessageParser {
    // "You added $ 10M to Doodly_yousuf's bounty"
    // "Doodly_yousuf added $10M to your bounty."
    private static final Pattern P = Pattern.compile(
            "^(?<actor>You|[A-Za-z0-9_]{1,16})\\s+added\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s+to\\s+(?<target>your|[A-Za-z0-9_]{1,16}'s)\\s+bounty\\.?\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String local = ctx.localPlayer();
        String actorRaw = m.group("actor");
        boolean actorLocal = actorRaw.equalsIgnoreCase("You");
        String actor = actorLocal ? local : actorRaw;
        String targetRaw = m.group("target");
        String target = targetRaw.equalsIgnoreCase("your")
                ? local
                : targetRaw.substring(0, targetRaw.length() - 2);   // strip trailing "'s"

        TransactionRecord t = new TransactionRecord();
        t.source = "CHAT";
        t.status = "COMPLETED";
        t.observed_by = local;
        t.recipient_username = target;   // the bounty that received the money
        t.buyer_username = actor;        // the payer
        t.seller_username = null;
        t.item_name = null;
        t.quantity = null;
        t.total_price = MoneyUtil.parse(m.group("price"));

        if (actorLocal) {
            t.transaction_type = "PAYMENT_SENT";
            t.transaction_owner = local;
            t.money_paid = t.total_price;
            t.money_received = "0";
            t.net_amount = t.total_price == null ? null : "-" + t.total_price;
        } else {
            t.transaction_type = "PAYMENT_SENT";   // observed: the actor performed it
            t.transaction_owner = actor;           // §10/§11: never reassigned to local
            t.money_paid = null;                   // §10: not the local player's cash flow
            t.money_received = null;
        }

        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null;
        return Optional.of(t);
    }
}
