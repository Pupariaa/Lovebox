#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <mbedtls/sha256.h>

struct BacSha256 {
    mbedtls_sha256_context ctx;
    bool active = false;

    void begin() {
        mbedtls_sha256_init(&ctx);
        mbedtls_sha256_starts(&ctx, 0);
        active = true;
    }

    void update(const uint8_t *data, size_t len) {
        if (!active || !data || len == 0) return;
        mbedtls_sha256_update(&ctx, data, len);
    }

    bool finishHex(char out[65]) {
        if (!active || !out) return false;
        uint8_t hash[32];
        if (mbedtls_sha256_finish(&ctx, hash) != 0) return false;
        active = false;
        static const char hex[] = "0123456789abcdef";
        for (int i = 0; i < 32; i++) {
            out[i * 2] = hex[(hash[i] >> 4) & 0x0f];
            out[i * 2 + 1] = hex[hash[i] & 0x0f];
        }
        out[64] = 0;
        return true;
    }

    bool finishRaw(uint8_t out[32]) {
        if (!active || !out) return false;
        if (mbedtls_sha256_finish(&ctx, out) != 0) return false;
        active = false;
        return true;
    }

    static bool equalsHex(const char *expected, const char *got) {
        if (!expected || !got) return false;
        if (strlen(expected) != 64 || strlen(got) != 64) return false;
        for (int i = 0; i < 64; i++) {
            char a = expected[i];
            char b = got[i];
            if (a >= 'A' && a <= 'F') a = (char)(a - 'A' + 'a');
            if (b >= 'A' && b <= 'F') b = (char)(b - 'A' + 'a');
            if (a != b) return false;
        }
        return true;
    }
};

#else

struct BacSha256 {
    void begin() {}
    void update(const uint8_t *, size_t) {}
    bool finishHex(char *) { return false; }
    bool finishRaw(unsigned char *) { return false; }
    static bool equalsHex(const char *, const char *) { return false; }
};

#endif
