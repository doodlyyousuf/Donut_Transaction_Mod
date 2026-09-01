package com.donutsmp.tracker.model;

// Money fields are Strings carrying exact BigDecimal values (e.g. "440000").
// The backend parses them into NUMERIC — no float ever touches money. §13
public class TransactionRecord {
    public String server;
    public String server_address;
    public String transaction_type;   // BUY SELL LIST ORDER_* PAYMENT_* UNKNOWN
    public String source;             // CHAT SELL_COMMAND ORDER_DELIVERY ...
    public String status;
    public String transaction_owner;  // §10 who performed it
    public String observed_by;        // §10 always the local player
    public String buyer_username;
    public String seller_username;
    public String recipient_username;
    public String item_name;          // NULL when unknowable (§5)
    public String item_id;
    public Long quantity;             // NULL when unknowable
    public String unit_price;
    public String total_price;
    public String money_paid;
    public String money_received;
    public String net_amount;
    public Long order_id;
    public String raw_message;        // §8 always preserved
    public String normalized_message;
    public boolean parsed_successfully;
    public String minecraft_timestamp;
    public String server_timestamp;
    public String created_at;
    public String fingerprint;        // §19
}
