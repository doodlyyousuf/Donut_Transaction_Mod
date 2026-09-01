package com.donutsmp.tracker.parser;

import com.donutsmp.tracker.model.*;
import java.util.Optional;

public interface MessageParser {
    Optional<TransactionRecord> tryParse(String normalized, ParserContext ctx);
}
