package com.donutsmp.tracker;

import com.donutsmp.tracker.config.TrackerConfig;
import com.donutsmp.tracker.core.BalanceCheckScheduler;
import com.donutsmp.tracker.core.BalanceWatcher;
import com.donutsmp.tracker.core.TrackerState;
import com.donutsmp.tracker.queue.OfflineQueue;
import com.donutsmp.tracker.sync.SyncService;
import com.donutsmp.tracker.ui.TrackerScreen;
import com.donutsmp.tracker.web.DashboardControl;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.message.v1.ClientSendMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.donutsmp.tracker.parser.MessageNormalizer;

// 26.1.x build: the game ships unobfuscated, so this variant uses the official
// Mojang class names (KeyMapping, Component, ...) instead of yarn names.
public class DonutTrackerClient implements ClientModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("TransactionTracker");
    public static TrackerState STATE;

    private static BalanceWatcher balanceWatcher;
    private static BalanceCheckScheduler balanceScheduler;
    private static String balanceCommand = "bal";
    /** Set while the mod itself is sending /bal, so it is not read as manual. */
    private static boolean autoSendingBalance;

    @Override
    public void onInitializeClient() {
        TrackerConfig config = TrackerConfig.load();
        OfflineQueue queue = new OfflineQueue(config);
        STATE = new TrackerState(config, queue);
        TrackerState.STATE = STATE;
        SyncService.wireQueue(queue);
        balanceWatcher = new BalanceWatcher();
        balanceScheduler = new BalanceCheckScheduler(
                config.autoBalanceCheck,
                config.balanceCheckCooldownSeconds * 1000L,
                config.balanceCheckPeriodicSeconds);
        balanceCommand = config.balanceCommandName();

        // §2: enable tracking only on *.donutsmp.net
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            var entry = client.getCurrentServer();
            String address = entry == null ? null : entry.ip;
            boolean donut = address != null
                    && address.toLowerCase().matches("(^|\\.)([a-z0-9-]+\\.)?donutsmp\\.net(:\\d+)?");
            STATE.onServerJoin(address, donut, client.getUser().getName());
            balanceScheduler.reset();
            LOGGER.info("[TransactionTracker] Server {} → tracking {}",
                    address == null ? "unknown" : address, donut ? "ENABLED" : "disabled");
        });
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
            STATE.onDisconnect();
            balanceScheduler.reset();
        });

        // Hide the mod's own balance replies from chat, but keep recording them.
        ClientReceiveMessageEvents.ALLOW_GAME.register((message, overlay) -> {
            if (overlay) return true;
            String raw = message.getString();
            if (balanceWatcher.shouldSuppress(MessageNormalizer.normalize(raw))) {
                STATE.onChat(raw);       // still captured as a balance snapshot
                return false;            // never rendered, so nothing piles up in chat
            }
            return true;
        });

        // §3: passive chat monitoring (GAME = every server-sent message)
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
            if (!overlay) STATE.onChat(message.getString());
        });

        // The player typing /bal or /balance keeps its reply visible.
        ClientSendMessageEvents.COMMAND.register(command -> {
            if (!autoSendingBalance && isBalanceCommand(command)) {
                balanceWatcher.expectManual();
            }
        });

        // §20: keybind (default Right Shift)
        KeyMapping openKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.donutsmp-tracker.open",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                KeyMapping.Category.register(
                        Identifier.fromNamespaceAndPath("donutsmp-tracker", "main"))));
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openKey.consumeClick()) client.setScreen(new TrackerScreen());
            if (STATE.isActive()
                    && balanceScheduler.tick(System.currentTimeMillis(), STATE.isBalanceCheckPending())) {
                STATE.clearBalanceCheckPending();
                sendAutoBalance(client);
            }
        });

        registerCommands();

        // §31: background sync worker
        SyncService.start(config, STATE);
        LOGGER.info("[TransactionTracker] initialized (backend={})", config.backendUrl);
    }

    private static boolean isBalanceCommand(String command) {
        if (command == null) return false;
        String c = command.trim().toLowerCase(java.util.Locale.ROOT);
        if (c.startsWith("/")) c = c.substring(1).trim();
        return c.equals("bal") || c.equals("balance");
    }

    private static void sendAutoBalance(Minecraft client) {
        if (client == null || client.player == null) return;
        autoSendingBalance = true;
        try {
            client.player.connection.sendCommand(balanceCommand);
            balanceWatcher.expectAuto();
        } catch (Exception e) {
            LOGGER.warn("[TransactionTracker] balance check failed", e);
        } finally {
            autoSendingBalance = false;
        }
    }

    private void registerCommands() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            dispatcher.register(ClientCommands.literal("transactions")
                .executes(ctx -> {
                    var s = ctx.getSource();
                    s.sendFeedback(Component.literal(String.format(
                        "§7Tracking: §f%s §8| §7Server: §f%s §8| §7Queue: §f%d §8| §7Local records: §f%d",
                        STATE.isActive() ? "ON" : "OFF",
                        STATE.serverAddress() == null ? "-" : STATE.serverAddress(),
                        STATE.queueSize(), STATE.localCount())));
                    return 1;
                })
                .then(ClientCommands.literal("sync").executes(ctx -> {
                    SyncService.requestImmediateSync();
                    ctx.getSource().sendFeedback(Component.literal("§7[Tracker] Sync requested."));
                    return 1;
                }))
                .then(ClientCommands.literal("status").executes(ctx -> {
                    var s = ctx.getSource();
                    DashboardControl.statusAsync().thenAccept(ok ->
                        s.sendFeedback(Component.literal(ok
                            ? "§a[Tracker] Backend reachable."
                            : "§c[Tracker] Backend unreachable — queueing locally.")));
                    return 1;
                }))
                .then(ClientCommands.literal("web")
                    .executes(ctx -> DashboardControl.openDashboard(ctx.getSource()))
                    .then(ClientCommands.literal("stop")
                        .executes(ctx -> DashboardControl.stopDashboard(ctx.getSource())))
                    .then(ClientCommands.literal("restart")
                        .executes(ctx -> DashboardControl.restartDashboard(ctx.getSource()))))
            );

            // §34: exchange an in-game code for a private dashboard session.
            dispatcher.register(ClientCommands.literal("tracker")
                .then(ClientCommands.literal("link").executes(ctx -> {
                    var s = ctx.getSource();
                    var mc = Minecraft.getInstance();
                    String username = mc.getUser().getName();
                    s.sendFeedback(Component.literal("§7[Tracker] Requesting a link code..."));
                    // Chat must be touched on the client thread; the HTTP call runs off it.
                    SyncService.requestLinkCode(username).thenAccept(msg ->
                        mc.execute(() -> s.sendFeedback(Component.literal(msg))));
                    return 1;
                }))
            );
        });
    }
}
