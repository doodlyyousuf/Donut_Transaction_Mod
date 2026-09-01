package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.*;

public final class ParserRegistry {
    // Order matters: first match wins. Add new parsers here (§40).
    private static final List<MessageParser> PARSERS = List.of(
            new SellMoneyParser(),   // cheap, very specific "$ 63.7K"
            new BuyParser(),
            new ListingParser(),
            new DeliveryParser());

    public static Optional<TransactionRecord> parse(String normalized, ParserContext ctx) {
        for (MessageParser p : PARSERS) {
            Optional<TransactionRecord> r = p.tryParse(normalized, ctx);
            if (r.isPresent()) return r;
        }
        return Optional.empty();
    }
}
