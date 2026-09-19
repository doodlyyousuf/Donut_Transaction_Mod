package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class PlayerSellMultipleParser implements MessageParser {
    // "SideWayzzzz sold multiple items for $ 2.5K"   (item/qty unknowable → §5/§41)
    // A sale means the seller received the money, whether local or observed on
    // another player, so the amount is booked as that owner's income.
    private static final Pattern P = Pattern.compile(
            "^(?<owner>You|[A-Za-z0-9_]{1,16})\\s+sold\\s+multiple\\s+items\\s+for\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String ownerRaw = m.group("owner");
        boolean local = ownerRaw.equalsIgnoreCase("You");
        String owner = local ? ctx.localPlayer() : ownerRaw;

        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "SELL";
        t.source = "CHAT";
        t.transaction_owner = owner;             // §10/§11: never reassigned to local
        t.observed_by = ctx.localPlayer();
        t.seller_username = owner;
        t.item_name = null;                      // §5/§41: "multiple items" is not a name
        t.quantity = null;
        t.total_price = MoneyUtil.parse(m.group("price"));
        t.money_received = t.total_price;        // selling always earns the owner
        t.money_paid = "0";
        t.net_amount = t.total_price;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null;
        return Optional.of(t);
    }
}
