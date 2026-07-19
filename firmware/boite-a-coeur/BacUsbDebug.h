#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <Update.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include <esp_ota_ops.h>
#include "BacApp.h"
#include "BacDebug.h"
#include "BacFirmware.h"
#include "BacSha256.h"
#include "BacSysInfo.h"
#include <Lucarne.h>

struct BacUsbDebug {
    static constexpr size_t kMaxChunkBytes = 384;
    static constexpr size_t kMaxLine = 1100;

    static bool handleLine(BacApp &app, const String &line) {
        if (!line.startsWith("@BAC ")) return false;
        String cmd = line.substring(5);
        cmd.trim();
        if (cmd.length() == 0) return true;
        String lower = cmd;
        lower.toLowerCase();

        if (lower == "ping") {
            replyPing(app);
        } else if (lower == "help") {
            replyHelp();
        } else if (lower == "analyze") {
            runAnalyze(app);
        } else if (lower.startsWith("flash_begin ")) {
            handleFlashBegin(app, cmd.substring(12));
        } else if (lower.startsWith("flash_chunk ")) {
            handleFlashChunk(cmd.substring(12));
        } else if (lower == "flash_abort") {
            handleFlashAbort();
        } else if (lower == "flash_end") {
            handleFlashEnd(app);
        } else if (isForbidden(lower)) {
            replyErr("readback forbidden");
        } else {
            replyErr("unknown bac command");
        }
        return true;
    }

    static size_t maxLineLength(const String &line) {
        if (line.startsWith("@BAC")) return kMaxLine;
        return 127;
    }

private:
    struct FlashSession {
        bool active = false;
        uint32_t expectedSize = 0;
        uint32_t received = 0;
        char expectedSha[65] = {};
        BacSha256 sha = {};
    };

    static FlashSession &session() {
        static FlashSession s;
        return s;
    }

    static void resetSession() {
        FlashSession &f = session();
        memset(&f, 0, sizeof(f));
    }

    static void send(const char *msg) {
        Serial.print(F("@BAC "));
        Serial.println(msg);
    }

    static void replyOk(const char *msg) {
        Serial.print(F("@BAC OK "));
        Serial.println(msg);
    }

    static void replyErr(const char *msg) {
        Serial.print(F("@BAC ERR "));
        Serial.println(msg);
    }

    static void replyHelp() {
        send("PROTO 1");
        send("COMMANDS PING HELP ANALYZE FLASH_BEGIN FLASH_CHUNK FLASH_END FLASH_ABORT");
        send("NOTE firmware write-only; no dump/read/export");
    }

    static void replyPing(BacApp &app) {
        const BacUserConfig &c = app.userConfig();
        Serial.print(F("@BAC OK PONG model=BAC-XS3 fw="));
        Serial.print(BAC_FW_VERSION);
        Serial.print(F(" serial="));
        Serial.print(c.serialNumber.length() ? c.serialNumber.c_str() : "-");
        Serial.print(F(" device="));
        Serial.print(c.deviceName.length() ? c.deviceName.c_str() : "-");
        Serial.println();
    }

    static bool isForbidden(const String &lower) {
        return lower.indexOf("read") >= 0 || lower.indexOf("dump") >= 0 || lower.indexOf("export") >= 0
            || lower.indexOf("download") >= 0 || lower.indexOf("extract") >= 0;
    }

    static bool canFlash(BacApp &app) {
        if (app.isOtaBusy()) return false;
        if (session().active) return false;
        return true;
    }

    static void runAnalyze(BacApp &app) {
        const BacUserConfig &c = app.userConfig();
        uint16_t issues = 0;
        send("ANALYZE_BEGIN");

        auto check = [&](const char *code, bool ok, const char *detail) {
            Serial.print(F("@BAC CHECK "));
            Serial.print(code);
            Serial.print(ok ? F(" ok ") : F(" fail "));
            Serial.println(detail);
            if (!ok) issues++;
        };

        check("serial", c.serialNumber.length() >= 8, c.serialNumber.length() ? c.serialNumber.c_str() : "missing");
        check("uuid", c.hasValidUuid(), c.hasValidUuid() ? "valid" : "invalid");
        check("wifi_config", c.wifiConfigured(), c.wifiConfigured() ? c.ssid.c_str() : "missing");
        check("wifi_link", app.isWifiLinked(), app.isWifiLinked() ? "connected" : "down");
        check("configured", c.configured, c.configured ? "yes" : "no");
        check("claimed", c.claimed, c.claimed ? "yes" : "no");
        check("cloud_secret", c.apiSecret.length() > 0, c.apiSecret.length() ? "set" : "missing");
        check("heap", ESP.getMinFreeHeap() > 32768, String(ESP.getMinFreeHeap()).c_str());
        check("psram", heap_caps_get_total_size(MALLOC_CAP_SPIRAM) > 0, "present");
        check("ffat", lucarne::volumeMounted(), lucarne::volumeMounted() ? "mounted" : "unmounted");
        check("mode_idle", app.isIdleForService(), app.modeName());
        check("ota_busy", !app.isOtaBusy(), app.isOtaBusy() ? "busy" : "idle");

        const esp_partition_t *running = esp_ota_get_running_partition();
        const esp_partition_t *next = esp_ota_get_next_update_partition(running);
        if (running) {
            Serial.print(F("@BAC INFO running="));
            Serial.print(running->label);
            Serial.print(F(" size="));
            Serial.println(running->size);
        }
        if (next) {
            Serial.print(F("@BAC INFO flash_target="));
            Serial.print(next->label);
            Serial.print(F(" size="));
            Serial.println(next->size);
        }

        esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
        if (running && esp_ota_get_state_partition(running, &state) == ESP_OK && state == ESP_OTA_IMG_PENDING_VERIFY) {
            check("ota_verify", false, "pending_verify");
        }

        if (app.isWifiLinked()) {
            Serial.print(F("@BAC INFO rssi="));
            Serial.println(WiFi.RSSI());
        }

        Serial.print(F("@BAC ANALYZE_END issues="));
        Serial.println(issues);
    }

    static bool parseHex64(const String &raw, char out[65]) {
        String s = raw;
        s.trim();
        s.toLowerCase();
        if (s.length() != 64) return false;
        for (int i = 0; i < 64; i++) {
            char c = s[i];
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
            out[i] = c;
        }
        out[64] = 0;
        return true;
    }

    static void handleFlashBegin(BacApp &app, String args) {
        FlashSession &flash = session();
        args.trim();
        if (!canFlash(app)) {
            replyErr("flash blocked");
            return;
        }

        int sizePos = args.indexOf("size=");
        int shaPos = args.indexOf("sha256=");
        if (sizePos < 0 || shaPos < 0) {
            replyErr("usage size=... sha256=...");
            return;
        }

        String sizeStr = args.substring(sizePos + 5);
        int sp = sizeStr.indexOf(' ');
        if (sp >= 0) sizeStr = sizeStr.substring(0, sp);
        sizeStr.trim();
        uint32_t size = (uint32_t)sizeStr.toInt();
        if (size == 0 || size < 100000) {
            replyErr("invalid size");
            return;
        }

        String shaStr = args.substring(shaPos + 7);
        shaStr.trim();

        resetSession();
        if (!parseHex64(shaStr, flash.expectedSha)) {
            replyErr("invalid sha256");
            return;
        }

        const esp_partition_t *target = esp_ota_get_next_update_partition(nullptr);
        if (!target) {
            replyErr("no ota slot");
            return;
        }
        if (size > target->size) {
            replyErr("firmware too large for slot");
            return;
        }

        if (!Update.begin(size, U_FLASH)) {
            replyErr("update begin failed");
            return;
        }

        flash.active = true;
        flash.expectedSize = size;
        flash.received = 0;
        flash.sha.begin();

        Serial.print(F("@BAC OK flash_ready target="));
        Serial.print(target->label);
        Serial.print(F(" max="));
        Serial.println(target->size);
    }

    static int hexVal(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    }

    static bool decodeHex(const String &hex, uint8_t *out, size_t outMax, size_t &written) {
        written = 0;
        if ((hex.length() % 2) != 0) return false;
        size_t nbytes = hex.length() / 2;
        if (nbytes > outMax) return false;
        for (size_t i = 0; i < nbytes; i++) {
            int hi = hexVal(hex[i * 2]);
            int lo = hexVal(hex[i * 2 + 1]);
            if (hi < 0 || lo < 0) return false;
            out[i] = (uint8_t)((hi << 4) | lo);
        }
        written = nbytes;
        return true;
    }

    static void handleFlashChunk(String hex) {
        FlashSession &flash = session();
        hex.trim();
        if (!flash.active) {
            replyErr("no flash session");
            return;
        }
        if (hex.length() == 0 || hex.length() > kMaxChunkBytes * 2) {
            replyErr("invalid chunk");
            return;
        }
        uint8_t buf[kMaxChunkBytes];
        size_t n = 0;
        if (!decodeHex(hex, buf, sizeof(buf), n)) {
            replyErr("hex decode failed");
            handleFlashAbort();
            return;
        }
        if (flash.received + n > flash.expectedSize) {
            replyErr("chunk overflow");
            handleFlashAbort();
            return;
        }
        flash.sha.update(buf, n);
        if (Update.write(buf, n) != n) {
            replyErr("flash write failed");
            handleFlashAbort();
            return;
        }
        flash.received += (uint32_t)n;
        Serial.print(F("@BAC OK chunk written="));
        Serial.print(n);
        Serial.print(F(" total="));
        Serial.println(flash.received);
    }

    static void handleFlashAbort() {
        if (session().active) Update.abort();
        resetSession();
        replyOk("flash_aborted");
    }

    static void handleFlashEnd(BacApp &app) {
        (void)app;
        FlashSession &flash = session();
        if (!flash.active) {
            replyErr("no flash session");
            return;
        }
        if (flash.received != flash.expectedSize) {
            replyErr("size mismatch");
            handleFlashAbort();
            return;
        }
        char gotSha[65];
        if (!flash.sha.finishHex(gotSha) || !BacSha256::equalsHex(flash.expectedSha, gotSha)) {
            replyErr("sha256 mismatch");
            handleFlashAbort();
            return;
        }
        if (!Update.end(true)) {
            replyErr("update end failed");
            handleFlashAbort();
            return;
        }
        resetSession();
        replyOk("flash_complete rebooting");
        delay(200);
        ESP.restart();
    }
};

#else

struct BacUsbDebug {
    static bool handleLine(BacApp &, const String &) { return false; }
    static size_t maxLineLength(const String &) { return 127; }
};

#endif
