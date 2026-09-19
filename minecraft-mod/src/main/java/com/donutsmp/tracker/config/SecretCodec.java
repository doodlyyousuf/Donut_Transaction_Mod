package com.donutsmp.tracker.config;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Obfuscates the shared tracker key so it is not trivially readable via
 * {@code strings} on the shipped jar or by opening the on-disk config.
 *
 * <p>This is a repeating-key XOR plus Base64. It is deliberately simple and is
 * <b>not</b> a cryptographic guarantee: anyone who inspects the running client
 * can still recover the value. It exists to stop casual discovery and copying
 * of the key, not to make it unforgeable.
 */
public final class SecretCodec {
    private static final int MASK = 0x3C;
    private static final int[] PHRASE = {
            68, 111, 110, 117, 116, 84, 114, 97, 99,
            107, 101, 114, 58, 58, 108, 101, 100, 103,
            101, 114, 45, 50, 48, 50, 54,
    };

    private SecretCodec() {}

    private static byte[] key() {
        byte[] k = new byte[PHRASE.length];
        for (int i = 0; i < PHRASE.length; i++) {
            k[i] = (byte) (PHRASE[i] ^ MASK);
        }
        return k;
    }

    private static byte[] xor(byte[] data) {
        byte[] k = key();
        byte[] out = new byte[data.length];
        for (int i = 0; i < data.length; i++) {
            out[i] = (byte) (data[i] ^ k[i % k.length]);
        }
        return out;
    }

    public static String encode(String plain) {
        if (plain == null || plain.isEmpty()) return "";
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(xor(plain.getBytes(StandardCharsets.UTF_8)));
    }

    public static String decode(String encoded) {
        if (encoded == null || encoded.isBlank()) return "";
        try {
            byte[] raw = Base64.getUrlDecoder().decode(encoded.trim());
            return new String(xor(raw), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return "";
        }
    }
}
