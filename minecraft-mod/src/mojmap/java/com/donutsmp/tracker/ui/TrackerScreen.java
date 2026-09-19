package com.donutsmp.tracker.ui;

import com.donutsmp.tracker.core.TrackerState;
import com.donutsmp.tracker.model.TransactionRecord;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.math.BigDecimal;
import java.util.*;

// 26.1.x build: official (Mojang) names. The render pipeline changed from
// Screen#render(GuiGraphics, ...) to Renderable#extractRenderState(GuiGraphicsExtractor, ...).
public class TrackerScreen extends Screen {
    private static final String[] TYPES = {"ALL", "BUY", "SELL", "LIST", "ORDER_DELIVERY"};
    private int typeIdx = 0, page = 0;
    private static final int PAGE_SIZE = 8;

    public TrackerScreen() { super(Component.literal("Transaction Tracker")); }

    @Override
    protected void init() {
        addRenderableWidget(Button.builder(
                Component.literal("Type: " + TYPES[typeIdx]), b -> {
                    typeIdx = (typeIdx + 1) % TYPES.length;
                    b.setMessage(Component.literal("Type: " + TYPES[typeIdx]));
                    page = 0;
                }).bounds(width / 2 - 90, height - 52, 90, 20).build());
        addRenderableWidget(Button.builder(
                Component.literal("< Prev"), b -> { if (page > 0) page--; })
                .bounds(width / 2 + 4, height - 52, 42, 20).build());
        addRenderableWidget(Button.builder(
                Component.literal("Next >"), b -> page++)
                .bounds(width / 2 + 50, height - 52, 42, 20).build());
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        super.extractRenderState(graphics, mouseX, mouseY, delta);
        if (minecraft == null || TrackerState.STATE == null) return;
        graphics.centeredText(this.font, this.title, width / 2, 12, 0xFFFFFF);

        // §20 dashboard aggregates (from local cache)
        List<TransactionRecord> all = TrackerState.STATE.recent(500);
        BigDecimal spent = all.stream().filter(t -> "BUY".equals(t.transaction_type))
                .map(t -> money(t.money_paid)).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal received = all.stream().filter(t -> "SELL".equals(t.transaction_type))
                .map(t -> money(t.money_received)).reduce(BigDecimal.ZERO, BigDecimal::add);
        graphics.text(this.font,
                String.format("Records: %d   Spent: $%s   Received: $%s   Net: $%s",
                        all.size(), fmt(spent), fmt(received), fmt(received.subtract(spent))),
                16, 28, 0xFFDDDDDD);

        // §21 filtered, paginated rows
        List<TransactionRecord> rows = new ArrayList<>(all);
        if (!"ALL".equals(TYPES[typeIdx]))
            rows.removeIf(t -> !TYPES[typeIdx].equals(t.transaction_type));
        int from = page * PAGE_SIZE;
        graphics.text(this.font,
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
                    t.total_price == null ? "-" : ("$" + fmt(money(t.total_price))));
            graphics.text(this.font, line, 16, 56 + i * 11, 0xFFE0E0E0);
        }
    }

    private static BigDecimal money(String raw) {
        if (raw == null) return BigDecimal.ZERO;
        try { return new BigDecimal(raw); } catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    private static String fmt(BigDecimal v) {
        return String.format("%,.2f", v);
    }

    private static String trunc(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n - 1) + "…";
    }
}
