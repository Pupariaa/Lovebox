#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <Update.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include <esp_ota_ops.h>
#include "BacApp.h"
#include "BacAssetsOta.h"
#include "BacDebug.h"
#include "BacFirmware.h"
#include "BacSha256.h"
#include "BacWatchdog.h"
#include "BacSysInfo.h"
#include <Lucarne.h>
#include <FFat.h>

struct BacUsbDebug {
    static constexpr size_t kMaxChunkBytes = 768;
    static constexpr size_t kMaxLine = 2048;
    static constexpr uint32_t kMaxAssetsPackBytes = 8388608;
    static constexpr uint32_t kMaxManifestBytes = 524288;

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
            app.enterUsbService(false);
            runAnalyze(app);
        } else if (lower.startsWith("flash_begin ")) {
            handleFlashBegin(app, cmd.substring(12));
        } else if (lower.startsWith("flash_chunk ")) {
            handleFlashChunk(app, cmd.substring(12));
        } else if (lower == "flash_abort") {
            handleFlashAbort(app);
        } else if (lower == "flash_end") {
            handleFlashEnd(app);
        } else if (lower.startsWith("assets_manifest_begin ")) {
            handleAssetsManifestBegin(app, cmd.substring(22));
        } else if (lower.startsWith("assets_manifest_chunk ")) {
            handleAssetsManifestChunk(app, cmd.substring(22));
        } else if (lower == "assets_manifest_end") {
            handleAssetsManifestEnd(app);
        } else if (lower.startsWith("assets_begin ")) {
            handleAssetsBegin(app, cmd.substring(13));
        } else if (lower.startsWith("assets_chunk ")) {
            handleAssetsChunk(app, cmd.substring(13));
        } else if (lower == "assets_abort") {
            handleAssetsAbort(app);
        } else if (lower == "assets_end") {
            handleAssetsEnd(app);
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

    struct AssetsSession {
        bool manifestReady = false;
        uint32_t manifestExpected = 0;
        uint32_t manifestReceived = 0;
        uint8_t *manifestBuf = nullptr;

        bool packActive = false;
        uint32_t packExpected = 0;
        uint32_t packReceived = 0;
        char packSha[65] = {};
        char version[32] = {};
        uint8_t *packBuf = nullptr;
        BacSha256 packShaCtx = {};
    };

    static FlashSession &session() {
        static FlashSession s;
        return s;
    }

    static AssetsSession &assetsSession() {
        static AssetsSession s;
        return s;
    }

    static void resetSession(BacApp &app) {
        if (session().active) app.leaveUsbService();
        FlashSession &f = session();
        memset(&f, 0, sizeof(f));
    }

    static void freeAssetsSession(AssetsSession &as) {
        if (as.manifestBuf) {
            heap_caps_free(as.manifestBuf);
            as.manifestBuf = nullptr;
        }
        if (as.packBuf) {
            heap_caps_free(as.packBuf);
            as.packBuf = nullptr;
        }
    }

    static void resetAssetsSession(BacApp &app) {
        if (assetsSession().packActive) app.leaveUsbService();
        AssetsSession &as = assetsSession();
        freeAssetsSession(as);
        memset(&as, 0, sizeof(as));
    }

    static void silentFlashAbort(BacApp &app) {
        if (session().active) Update.abort();
        resetSession(app);
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
        send("COMMANDS ASSETS_MANIFEST_BEGIN ASSETS_MANIFEST_CHUNK ASSETS_MANIFEST_END");
        send("COMMANDS ASSETS_BEGIN ASSETS_CHUNK ASSETS_END ASSETS_ABORT");
        send("NOTE firmware and assets write-only; no dump/read/export");
    }

    static void replyPing(BacApp &app) {
        app.enterUsbService(false);
        const BacUserConfig &c = app.userConfig();
        Serial.print(F("@BAC OK PONG model=BAC-XS3 fw="));
        Serial.print(BAC_FW_VERSION);
        Serial.print(F(" chunk_max="));
        Serial.print(kMaxChunkBytes);
        Serial.print(F(" line_max="));
        Serial.print(kMaxLine);
        Serial.print(F(" assets_usb=1 serial="));
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
        if (session().active || assetsSession().packActive || assetsSession().manifestBuf) return false;
        return true;
    }

    static bool canAssets(BacApp &app) {
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
        check("assets", BacAssetsOta::markerPresent(), BacAssetsOta::markerPresent() ? "installed" : "missing");
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

    static void assetsProgressThunk(void *ctx, int pct) {
        BacApp *app = (BacApp *)ctx;
        if (!app) return;
        app->setUsbFlashProgress((uint32_t)pct, 100);
        Serial.print(F("@BAC INFO assets_progress pct="));
        Serial.println(pct);
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

        resetSession(app);
        Update.abort();
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

        app.enterUsbService(true);
        app.setUsbFlashProgress(0, size);

        Serial.println(F("@BAC INFO flash_erase"));
        Serial.flush();
        BacWatchdog::unsubscribe();
        BacWatchdog::feed();
        if (!Update.begin(size, U_FLASH)) {
            BacWatchdog::subscribe();
            app.leaveUsbService();
            replyErr("update begin failed");
            return;
        }
        BacWatchdog::subscribe();

        flash.active = true;
        flash.expectedSize = size;
        flash.received = 0;
        flash.sha.begin();

        Serial.print(F("@BAC OK flash_ready target="));
        Serial.print(target->label);
        Serial.print(F(" max="));
        Serial.println(target->size);
    }

    static void handleFlashChunk(BacApp &app, String hex) {
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
            silentFlashAbort(app);
            return;
        }
        if (flash.received == 0 && (n == 0 || buf[0] != 0xE9)) {
            replyErr("bad esp32 image magic");
            silentFlashAbort(app);
            return;
        }
        if (flash.received + n > flash.expectedSize) {
            replyErr("chunk overflow");
            silentFlashAbort(app);
            return;
        }
        flash.sha.update(buf, n);
        BacWatchdog::feed();
        if (Update.write(buf, n) != n) {
            replyErr("flash write failed");
            silentFlashAbort(app);
            return;
        }
        flash.received += (uint32_t)n;
        app.setUsbFlashProgress(flash.received, flash.expectedSize);
        Serial.print(F("@BAC OK chunk written="));
        Serial.print(n);
        Serial.print(F(" total="));
        Serial.println(flash.received);
    }

    static void handleFlashAbort(BacApp &app) {
        if (session().active) Update.abort();
        resetSession(app);
        replyOk("flash_aborted");
    }

    static void handleFlashEnd(BacApp &app) {
        FlashSession &flash = session();
        if (!flash.active) {
            replyErr("no flash session");
            return;
        }
        if (flash.received != flash.expectedSize) {
            replyErr("size mismatch");
            silentFlashAbort(app);
            return;
        }
        char gotSha[65];
        if (!flash.sha.finishHex(gotSha) || !BacSha256::equalsHex(flash.expectedSha, gotSha)) {
            replyErr("sha256 mismatch");
            silentFlashAbort(app);
            return;
        }
        if (!Update.end(true)) {
            replyErr("update end failed");
            silentFlashAbort(app);
            return;
        }
        app.setUsbFlashProgress(flash.expectedSize, flash.expectedSize);
        FlashSession &f = session();
        memset(&f, 0, sizeof(f));
        replyOk("flash_complete rebooting");
        delay(200);
        ESP.restart();
    }

    static void handleAssetsManifestBegin(BacApp &app, String args) {
        AssetsSession &as = assetsSession();
        if (!canAssets(app) || as.packActive) {
            replyErr("assets blocked");
            return;
        }
        args.trim();
        int sizePos = args.indexOf("size=");
        if (sizePos < 0) {
            replyErr("usage size=...");
            return;
        }
        String sizeStr = args.substring(sizePos + 5);
        sizeStr.trim();
        uint32_t size = (uint32_t)sizeStr.toInt();
        if (size == 0 || size > kMaxManifestBytes) {
            replyErr("invalid manifest size");
            return;
        }
        resetAssetsSession(app);
        as.manifestBuf = (uint8_t *)heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!as.manifestBuf) {
            resetAssetsSession(app);
            replyErr("manifest alloc failed");
            return;
        }
        as.manifestExpected = size;
        as.manifestReceived = 0;
        replyOk("assets_manifest_ready");
    }

    static void handleAssetsManifestChunk(BacApp &app, String hex) {
        AssetsSession &as = assetsSession();
        hex.trim();
        if (!as.manifestBuf || as.manifestReady) {
            replyErr("no manifest session");
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
            resetAssetsSession(app);
            return;
        }
        if (as.manifestReceived + n > as.manifestExpected) {
            replyErr("chunk overflow");
            resetAssetsSession(app);
            return;
        }
        memcpy(as.manifestBuf + as.manifestReceived, buf, n);
        as.manifestReceived += (uint32_t)n;
        Serial.print(F("@BAC OK manifest_chunk written="));
        Serial.print(n);
        Serial.print(F(" total="));
        Serial.println(as.manifestReceived);
    }

    static void handleAssetsManifestEnd(BacApp &app) {
        AssetsSession &as = assetsSession();
        if (!as.manifestBuf || as.manifestReady) {
            replyErr("no manifest session");
            return;
        }
        if (as.manifestReceived != as.manifestExpected) {
            replyErr("manifest size mismatch");
            resetAssetsSession(app);
            return;
        }
        if (!BacAssetsOta::manifestBufferValid(as.manifestBuf, as.manifestExpected)) {
            replyErr("invalid manifest");
            resetAssetsSession(app);
            return;
        }
        as.manifestReady = true;
        replyOk("assets_manifest_complete");
    }

    static void handleAssetsBegin(BacApp &app, String args) {
        AssetsSession &as = assetsSession();
        args.trim();
        if (!canAssets(app) || as.packActive) {
            replyErr("assets blocked");
            return;
        }
        if (as.manifestBuf && !as.manifestReady) {
            replyErr("manifest incomplete");
            return;
        }

        int sizePos = args.indexOf("size=");
        int shaPos = args.indexOf("sha256=");
        int verPos = args.indexOf("version=");
        if (sizePos < 0 || shaPos < 0) {
            replyErr("usage size=... sha256=... version=...");
            return;
        }

        String sizeStr = args.substring(sizePos + 5);
        int sp = sizeStr.indexOf(' ');
        if (sp >= 0) sizeStr = sizeStr.substring(0, sp);
        sizeStr.trim();
        uint32_t size = (uint32_t)sizeStr.toInt();
        if (size == 0 || size > kMaxAssetsPackBytes) {
            replyErr("invalid size");
            return;
        }

        String shaStr = args.substring(shaPos + 7);
        int shaEnd = shaStr.indexOf(' ');
        if (shaEnd >= 0) shaStr = shaStr.substring(0, shaEnd);
        shaStr.trim();

        if (!as.manifestReady && !as.manifestBuf) {
            resetAssetsSession(app);
        } else if (as.packBuf) {
            heap_caps_free(as.packBuf);
            as.packBuf = nullptr;
            as.packActive = false;
            as.packExpected = 0;
            as.packReceived = 0;
            memset(as.packSha, 0, sizeof(as.packSha));
            as.packShaCtx = BacSha256{};
        }

        as.packBuf = (uint8_t *)heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!as.packBuf) {
            resetAssetsSession(app);
            replyErr("psram alloc failed");
            return;
        }

        if (!parseHex64(shaStr, as.packSha)) {
            resetAssetsSession(app);
            replyErr("invalid sha256");
            return;
        }

        as.version[0] = 0;
        if (verPos >= 0) {
            String verStr = args.substring(verPos + 8);
            verStr.trim();
            if (verStr.length() > 0) {
                verStr.toCharArray(as.version, sizeof(as.version));
            }
        }

        app.enterUsbService(true);
        app.setUsbFlashProgress(0, size);

        as.packActive = true;
        as.packExpected = size;
        as.packReceived = 0;
        as.packShaCtx.begin();

        Serial.print(F("@BAC OK assets_ready size="));
        Serial.println(size);
    }

    static void handleAssetsChunk(BacApp &app, String hex) {
        AssetsSession &as = assetsSession();
        hex.trim();
        if (!as.packActive || !as.packBuf) {
            replyErr("no assets session");
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
            resetAssetsSession(app);
            return;
        }
        if (as.packReceived + n > as.packExpected) {
            replyErr("chunk overflow");
            resetAssetsSession(app);
            return;
        }
        if (as.packReceived == 0 && (n == 0 || buf[0] != 'B' || buf[1] != 'A' || buf[2] != 'C' || buf[3] != 'A')) {
            replyErr("bad assets pack magic");
            resetAssetsSession(app);
            return;
        }
        as.packShaCtx.update(buf, n);
        memcpy(as.packBuf + as.packReceived, buf, n);
        as.packReceived += (uint32_t)n;
        app.setUsbFlashProgress(as.packReceived, as.packExpected);
        Serial.print(F("@BAC OK assets_chunk written="));
        Serial.print(n);
        Serial.print(F(" total="));
        Serial.println(as.packReceived);
    }

    static void handleAssetsAbort(BacApp &app) {
        resetAssetsSession(app);
        replyOk("assets_aborted");
    }

    static void handleAssetsEnd(BacApp &app) {
        AssetsSession &as = assetsSession();
        if (!as.packActive || !as.packBuf) {
            replyErr("no assets session");
            return;
        }
        if (as.packReceived != as.packExpected) {
            replyErr("size mismatch");
            resetAssetsSession(app);
            return;
        }
        char gotSha[65];
        if (!as.packShaCtx.finishHex(gotSha) || !BacSha256::equalsHex(as.packSha, gotSha)) {
            replyErr("sha256 mismatch");
            resetAssetsSession(app);
            return;
        }

        Serial.println(F("@BAC INFO assets_install"));
        BacWatchdog::unsubscribe();
        BacWatchdog::feed();
        bool shaFail = false;
        const uint8_t *manifestData = (as.manifestReady && as.manifestBuf) ? as.manifestBuf : nullptr;
        uint32_t manifestSize = (as.manifestReady && as.manifestBuf) ? as.manifestExpected : 0;
        const char *version = as.version[0] ? as.version : nullptr;
        bool ok = BacAssetsOta::installPackFromBuffer(as.packBuf, as.packExpected, as.packSha, &assetsProgressThunk,
                                                      &app, &shaFail, version, manifestData, manifestSize, true);
        BacWatchdog::subscribe();
        resetAssetsSession(app);
        if (!ok) {
            if (!lucarne::volumeMounted()) lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            replyErr(shaFail ? "assets sha mismatch" : "assets install failed");
            return;
        }
        replyOk("assets_complete");
        Serial.flush();
        app.leaveUsbService();
        app.setUsbFlashProgress(100, 100);
        delay(50);
        if (!lucarne::volumeMounted()) lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
    }
};

#else

struct BacUsbDebug {
    static bool handleLine(BacApp &, const String &) { return false; }
    static size_t maxLineLength(const String &) { return 127; }
};

#endif
