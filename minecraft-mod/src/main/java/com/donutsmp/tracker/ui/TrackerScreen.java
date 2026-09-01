package com.donutsmp.tracker.ui;

import com.donutsmp.tracker.core.TrackerState;
import com.donutsmp.tracker.model.TransactionRecord;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.*;

public class TrackerScreen extends Screen {
    private static final String[] TYPES = {"ALL", "BUY", "SELL", "LIST", "ORDER_DELIVERY"};
    private int typeIdx = 0, page = 0;
    private static final int PAGE_SIZE = 8;

    public TrackerScreen() { super(Text.literal("Transaction Tracker")); }

    @Override
    protected void init() {
        addDrawableChild(ButtonWidget.builder(
                Text.literal("Type: " + TYPES[typeIdx]), b -> {
                    typeIdx = (typeIdx + 1) % TYPES.length;
                    b.setMessage(Text.literal("Type: " + TYPES[typeIdx]));
                    page = 0;
                }).dimensions(width / 2 - 90, height - 52, 90, 20).build());
        addDrawableChild(ButtonWidget.builder(
                Text.literal("< Prev"), b -> { if (page > 0) page--; })
                .dimensions(width / 2 + 4, height - 52, 42, 20).build());
        addDrawableChild(ButtonWidget.builder(
                Text.literal("Next >"), b -> page++)
                .dimensions(width / 2 + 50, height - 52, 42, 20).build());
    }

    @Override
    public void render(DrawContext ctx, int mx, int my, float delta) {
        super.render(ctx, mx, my, delta);
        if (client == null || TrackerState.STATE == null) return;
        ctx.drawCenteredTextWithShadow(this.textRenderer, this.title,
                width / 2, 12, 0xFFFFFF);

        // §20 dashboard aggregates (from local cache)
        List<TransactionRecord> all = TrackerState.STATE.recent(500);
        long spent = all.stream().filter(t -> "BUY".equals(t.transaction_type))
                .mapToLong(t -> t.money_paid == null ? 0 : Long.parseLong(t.money_paid)).sum();
        long received = all.stream().filter(t -> "SELL".equals(t.transaction_type))
                .mapToLong(t -> t.money_received == null ? 0 : Long.parseLong(t.money_received)).sum();
        ctx.drawTextWithShadow(this.textRenderer,
                String.format("Records: %d   Spent: $%s   Received: $%s   Net: $%d",
                        all.size(), fmt(spent), fmt(received), received - spent),
                16, 28, 0xAARRGGBB & 0xFFDDDDDD);

        // §21 filtered, paginated rows
        List<TransactionRecord> rows = new ArrayList<>(all);
        if (!"ALL".equals(TYPES[typeIdx]))
            rows.removeIf(t -> !TYPES[typeIdx].equals(t.transaction_type));
        int from = page * PAGE_SIZE;
        ctx.drawTextWithShadow(this.textRenderer,
                "Time       Player            Action          Item / Qty              Amount",
                16, 44, 0xFF8899AA);
        for (int i = 0; i < PAGE_SIZE && from + i < rows.size(); i++) {
            TransactionRecord t = rows.get(from + i);
            String time = t.minecraft_timestamp == null ? "--:--:--" : t.minecraft_timestamp;
            String line = String.format("%-10s %-17s %-15s %-24s %s",
                    time,
                    trunc(t.transaction_owner == null ? "?" : t.transaction_owner, 17),
                    t.transaction_type,
                    trunc((t.quantity == null ? "?" : t.quantity) + "x " +
                            (t.item_name == null ? "(unknown)" : t.item_name), 24),
                    t.total_price == null ? "-" : ("$" + fmt(Long.parseLong(t.total_price))));
            ctx.drawTextWithShadow(this.textRenderer, line, 16, 56 + i * 11, 0xFFE0E0E0);
        }
    }

    private static String fmt(long v) {
        return String.format("%,d", v);
    }

    private static String trunc(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n - 1) + "…";
    }
}
