#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include "BacDebug.h"
#include "BacSha256.h"
#include "BacTls.h"
#include "BacUrlFailover.h"

struct BacOta {
    typedef void (*ProgressFn)(void *ctx, int percent);
    static constexpr size_t kBufSize = 8192;

    static bool installFromUrl(const char *url, uint32_t expectedSize, const char *expectedSha256,
                               ProgressFn progress, void *ctx, bool *shaMismatch = nullptr) {
        if (!url || !url[0] || WiFi.status() != WL_CONNECTED) {
            BacDebug::event("ota", "wifi or url missing");
            return false;
        }
        if (!expectedSha256 || strlen(expectedSha256) != 64 || expectedSize == 0) {
            BacDebug::event("ota", "invalid expected hash or size");
            return false;
        }
        BacDebug::eventf("ota", "firmware download %s", url);
        for (size_t hostIdx = 0; hostIdx < BacUrlFailover::hostCount(); hostIdx++) {
            String attempt = BacUrlFailover::rewriteBase(url, BacUrlFailover::defaultHost(hostIdx));
            WiFiClientSecure client;
            BacTls::configure(client);
            HTTPClient http;
            http.setTimeout(180000);
            if (!http.begin(client, attempt)) continue;
            http.addHeader("Accept-Encoding", "identity");
            int code = http.GET();
            if (code != 200) {
                BacDebug::eventf("ota", "http %d host=%u", code, (unsigned)hostIdx);
                http.end();
                continue;
            }
            int len = http.getSize();
            if (len <= 0 || (uint32_t)len != expectedSize) {
                BacDebug::eventf("ota", "size mismatch got=%d expected=%lu", len, (unsigned long)expectedSize);
                http.end();
                continue;
            }
            if (!Update.begin((size_t)len)) {
                BacDebug::eventf("ota", "begin failed err=%u", (unsigned)Update.getError());
                http.end();
                continue;
            }
            WiFiClient *stream = http.getStreamPtr();
            uint8_t buf[kBufSize];
            size_t total = 0;
            BacSha256 sha;
            sha.begin();
            while (http.connected() && total < (size_t)len) {
                size_t avail = stream->available();
                if (avail == 0) {
                    delay(1);
                    continue;
                }
                if (avail > kBufSize) avail = kBufSize;
                int read = stream->readBytes(buf, avail);
                if (read <= 0) break;
                sha.update(buf, (size_t)read);
                if (Update.write(buf, (size_t)read) != (size_t)read) {
                    BacDebug::event("ota", "write failed");
                    Update.abort();
                    http.end();
                    return false;
                }
                total += (size_t)read;
                if (progress) {
                    int pct = (int)((total * 100ULL) / (size_t)len);
                    progress(ctx, pct);
                }
            }
            http.end();
            if (total != (size_t)len) {
                Update.abort();
                continue;
            }
            char gotSha[65];
            if (!sha.finishHex(gotSha) || !BacSha256::equalsHex(expectedSha256, gotSha)) {
                if (shaMismatch) *shaMismatch = true;
                Update.abort();
                BacDebug::event("ota", "sha256 mismatch");
                return false;
            }
            if (!Update.end(true)) {
                BacDebug::eventf("ota", "end failed err=%u", (unsigned)Update.getError());
                return false;
            }
            BacDebug::eventf("ota", "firmware ok %u bytes", (unsigned)total);
            return true;
        }
        BacDebug::event("ota", "all hosts failed");
        return false;
    }
};

#else

struct BacOta {
    typedef void (*ProgressFn)(void *, int);
    static bool installFromUrl(const char *, uint32_t, const char *, ProgressFn, void *) { return false; }
};

#endif
