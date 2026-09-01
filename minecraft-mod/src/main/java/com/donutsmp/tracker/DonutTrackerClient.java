package com.donutsmp.tracker;

import com.donutsmp.tracker.config.TrackerConfig;
import com.donutsmp.tracker.core.TrackerState;
import com.donutsmp.tracker.queue.OfflineQueue;
import com.donutsmp.tracker.sync.SyncService;
import com.donutsmp.tracker.ui.TrackerScreen;
import com.donutsmp.tracker.web.DashboardControl;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.donutsmp.tracker.model.ParserContext;

public class DonutTrackerClient implements ClientModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("TransactionTracker");
    public static TrackerState STATE;

    @Override
    public void onInitializeClient() {
        TrackerConfig config = TrackerConfig.load();
        OfflineQueue queue = new OfflineQueue(config);
        STATE = new TrackerState(config, queue);
        TrackerState.STATE = STATE;
        SyncService.wireQueue(queue);

        // §2: enable tracking only on *.donutsmp.net
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            var entry = client.getCurrentServerEntry();
            String address = entry == null ? null : entry.address;
            boolean donut = address != null
                    && address.toLowerCase().matches("(^|\\.)([a-z0-9-]+\\.)?donutsmp\\.net(:\\d+)?");
            STATE.onServerJoin(address, donut, client.getSession().getUsername());
            LOGGER.info("[TransactionTracker] Server {} → tracking {}",
                    address == null ? "unknown" : address, donut ? "ENABLED" : "disabled");
        });
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> STATE.onDisconnect());

        // §3: passive chat monitoring (GAME = every server-sent message)
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
            if (!overlay) STATE.onChat(message.getString());
        });

        // §20: keybind (default Right Shift)
        KeyBinding openKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.donutsmp-tracker.open",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                // 1.21.9+ uses KeyBinding.Category; on older mappings use
                // the String-category constructor: "category.donutsmp-tracker"
                KeyBinding.Category.create(
                        net.minecraft.util.Identifier.of("donutsmp-tracker", "main"))));
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openKey.wasPressed()) client.setScreen(new TrackerScreen());
        });

        registerCommands();

        // §31: background sync worker
        SyncService.start(config, STATE);
        LOGGER.info("[TransactionTracker] initialized (backend={})", config.backendUrl);
    }

    private void registerCommands() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            dispatcher.register(ClientCommandManager.literal("transactions")
                .executes(ctx -> {
                    var s = ctx.getSource();
                    s.sendFeedback(Text.literal(String.format(
                        "§7Tracking: §f%s §8| §7Server: §f%s §8| §7Queue: §f%d §8| §7Local records: §f%d",
                        STATE.isActive() ? "ON" : "OFF",
                        STATE.serverAddress() == null ? "-" : STATE.serverAddress(),
                        STATE.queueSize(), STATE.localCount())));
                    return 1;
                })
                .then(ClientCommandManager.literal("sync").executes(ctx -> {
                    SyncService.requestImmediateSync();
                    ctx.getSource().sendFeedback(Text.literal("§7[Tracker] Sync requested."));
                    return 1;
                }))
                .then(ClientCommandManager.literal("status").executes(ctx -> {
                    DashboardControl.statusAsync().thenAccept(ok ->
                        ctx.getSource().sendFeedback(Text.literal(ok
                            ? "§a[Tracker] Backend reachable."
                            : "§c[Tracker] Backend unreachable — queueing locally.")));
                    return 1;
                }))
                .then(ClientCommandManager.literal("web")
                    .executes(ctx -> DashboardControl.openDashboard(ctx.getSource()))
                    .then(ClientCommandManager.literal("stop").executes(ctx ->
                        DashboardControl.stopDashboard(ctx.getSource())))
                    .then(ClientCommandManager.literal("restart").executes(ctx ->
                        DashboardControl.restartDashboard(ctx.getSource()))));
        });
    }
}
