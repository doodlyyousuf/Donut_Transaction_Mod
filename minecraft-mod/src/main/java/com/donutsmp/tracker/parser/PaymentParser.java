package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

public class PaymentParser implements MessageParser {
    // "SideWayzzzz was paid $ 25M by Schtiev123"
    // "True_Horror was paid $ 100K by .RLEIO4566"   (dotted accounts preserved)
    private static final Pattern P = Pattern.compile(
            "^(?<recipient>You|[A-Za-z0-9_.]{1,16})\\s+(?:was|were)\\s+paid\\s+\\$\\s*(?<price>[\\d.,]+\\s*[KkMmBbTt]?)\\s+by\\s+(?<payer>[A-Za-z0-9_.]{1,16})\\s*$",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher m = P.matcher(msg);
        if (!m.matches()) return Optional.empty();
        String local = ctx.localPlayer();
        String recipientRaw = m.group("recipient");
        String recipient = recipientRaw.equalsIgnoreCase("You") ? local : recipientRaw;
        String payerRaw = m.group("payer");
        String payer = payerRaw.equalsIgnoreCase("You") ? local : payerRaw;
        boolean recipientLocal = recipient.equalsIgnoreCase(local);
        boolean payerLocal = payer.equalsIgnoreCase(local);

        TransactionRecord t = new TransactionRecord();
        t.source = "CHAT";
        t.status = "COMPLETED";
        t.observed_by = local;
        t.recipient_username = recipient;
        t.buyer_username = payer;      // the payer is the one who sent the money
        t.seller_username = null;      // §41: not a sale
        t.item_name = null;
        t.quantity = null;
        t.total_price = MoneyUtil.parse(m.group("price"));

        if (recipientLocal) {
            t.transaction_type = "PAYMENT_RECEIVED";
            t.transaction_owner = local;
            t.money_received = t.total_price;
            t.money_paid = "0";
            t.net_amount = t.total_price;
        } else if (payerLocal) {
            t.transaction_type = "PAYMENT_SENT";
            t.transaction_owner = local;
            t.money_paid = t.total_price;
            t.money_received = "0";
            t.net_amount = t.total_price == null ? null : "-" + t.total_price;
        } else {
            t.transaction_type = "PAYMENT_SENT";   // observed: the payer performed it
            t.transaction_owner = payer;           // §10/§11: never reassigned to local
            t.money_paid = t.total_price;          // the payer's outflow is real, even observed
            t.money_received = "0";
            t.net_amount = t.total_price == null ? null : "-" + t.total_price;
            // ParserRegistry adds the payee's mirrored PAYMENT_RECEIVED entry so
            // both observed players get the transfer in their totals.
        }

        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = t.total_price != null;
        return Optional.of(t);
    }
}
