package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;
import java.util.regex.*;

/**
 * Observed player balances. These are snapshots of state, not transactions:
 * the amount is carried in total_price while money_paid/money_received stay
 * NULL, so a balance check can never be counted as income (§41).
 *
 * Two formats:
 *   "$100,982,091"              local player's /bal reply (legacy, no space)
 *   "You have $ 313,162,724"    local player's /bal reply (current)
 *   "F18 has $ 105K"            another player's balance
 *
 * The local forms are deliberately anchored to a digit after the "$". The
 * standalone /sell payout form ("$ 1.2M") always has a K/M/B suffix, so the
 * two never collide.
 */
public class BalanceParser implements MessageParser {

    private static final Pattern LOCAL = Pattern.compile(
            "^\\$(?<amount>[0-9][0-9,]*(?:\\.[0-9]+)?)\\s*$");

    private static final Pattern OWN = Pattern.compile(
            "^You have \\$\\s*(?<amount>[\\d.,]+)\\s*$",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern OTHER = Pattern.compile(
            "^(?<player>[A-Za-z0-9_]{1,16}) has \\$\\s*(?<amount>[\\d.,]+\\s*[KkMmBbTt]?)\\s*$",
            Pattern.CASE_INSENSITIVE);

    /**
     * True when a line is the local player's own balance reply, i.e. what a
     * {@code /bal} issued by this client comes back as. Used to decide which
     * chat lines may be suppressed after a mod-triggered balance check.
     */
    public static boolean matchesLocalBalance(String normalized) {
        if (normalized == null) return false;
        if (!OWN.matcher(normalized).matches() && !LOCAL.matcher(normalized).matches()) {
            return false;
        }
        Matcher m = OWN.matcher(normalized);
        String amount = m.matches() ? m.group("amount") : null;
        if (amount == null) {
            Matcher l = LOCAL.matcher(normalized);
            amount = l.matches() ? l.group("amount") : null;
        }
        return amount != null && MoneyUtil.parse(amount) != null;
    }

    @Override
    public Optional<TransactionRecord> tryParse(String msg, ParserContext ctx) {
        Matcher own = OWN.matcher(msg);
        if (own.matches()) {
            String amount = MoneyUtil.parse(own.group("amount"));
            if (amount == null) return Optional.empty();
            return Optional.of(build(amount, ctx.localPlayer(), msg, ctx));
        }

        Matcher local = LOCAL.matcher(msg);
        if (local.matches()) {
            String amount = MoneyUtil.parse(local.group("amount"));
            if (amount == null) return Optional.empty();
            return Optional.of(build(amount, ctx.localPlayer(), msg, ctx));
        }

        Matcher other = OTHER.matcher(msg);
        if (other.matches()) {
            String amount = MoneyUtil.parse(other.group("amount"));
            if (amount == null) return Optional.empty();
            return Optional.of(build(amount, other.group("player"), msg, ctx));
        }

        return Optional.empty();
    }

    private TransactionRecord build(String amount, String owner, String msg, ParserContext ctx) {
        TransactionRecord t = new TransactionRecord();
        t.transaction_type = "BALANCE";
        t.source = "BALANCE";
        t.status = "OBSERVED";
        t.transaction_owner = owner;
        t.observed_by = ctx.localPlayer();
        t.total_price = amount;
        t.money_paid = null;        // §41: a balance is not income or spending
        t.money_received = null;
        t.item_name = null;
        t.quantity = null;
        t.raw_message = ctx.rawMessage();
        t.normalized_message = msg;
        t.minecraft_timestamp = ctx.minecraftTimestamp();
        t.parsed_successfully = true;
        return t;
    }
}
