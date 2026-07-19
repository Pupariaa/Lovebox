#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Lucarne.h>
#include <FFat.h>
#include "BacDebug.h"
#include "BacSha256.h"
#include "BacTls.h"
#include "BacWatchdog.h"

struct BacAssetsOta {
    typedef void (*ProgressFn)(void *ctx, int percent);
    static constexpr size_t kBufSize = 8192;
    static constexpr const char *kLegacyStagingPath = "/ota/staging.baca";
    static constexpr const char *kAssetsDir = "/assets";
    static constexpr const char *kStagingDir = "/assets_new";
    static constexpr const char *kBackupDir = "/assets_old";
    static constexpr const char *kStagingMarkerPath = "/assets_new/.ok";
    static constexpr const char *kStagingManifestPath = "/assets_new/.manifest";
    static constexpr const char *kMarkerPath = "/assets/.ok";
    // Persistent manifest describing what is currently on disk, used to diff-sync the
    // next update. The freshly downloaded manifest is staged at the FFAT root (outside
    // /assets) so a full-install wipe never deletes it before we can promote it.
    static constexpr const char *kManifestPath = "/assets/.manifest";
    static constexpr const char *kManifestTmpPath = "/.manifest.new";
    // Max records coalesced into a single HTTP Range request. Consecutive changed files
    // are contiguous in the pack, so one emoji (~72 frames) is one range fetch.
    static constexpr int kMaxRun = 64;

    struct ManifestEntry {
        char path[192];
        uint16_t pathLen;
        uint32_t size;
        uint32_t recordOffset;
        uint8_t sha[32];
    };

    // Differential install: FFAT is only 9 MB and the packed assets are ~8.4 MB.
    // When a per-file manifest is available and we already have a local one, only the
    // changed byte ranges are fetched (via HTTP Range into assets.bacassets) and stale
    // files deleted. Otherwise (no manifest, no local baseline, or too many changes) we
    // fall back to a full streaming install into a staging tree that is swapped in atomically.
    static bool installPackFromUrl(const char *url, uint32_t expectedSize, const char *expectedSha256,
                                   ProgressFn progress, void *ctx, bool *shaMismatch = nullptr,
                                   const char *version = nullptr, const char *manifestUrl = nullptr) {
        if (!url || !url[0] || WiFi.status() != WL_CONNECTED) {
            BacDebug::event("assets", "wifi or url missing");
            return false;
        }
        if (!expectedSha256 || strlen(expectedSha256) != 64 || expectedSize == 0) {
            BacDebug::event("assets", "invalid expected hash or size");
            return false;
        }

        lucarne::unmountVolume();
        if (!FFat.begin(false, "/ffat", 10, "ffat")) {
            BacDebug::event("assets", "ffat mount failed");
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            return false;
        }

        removeLegacyStaging(FFat);

        bool didDiff = false;
        bool haveNewManifest = false;
        bool ok = false;

        if (manifestUrl && manifestUrl[0]) {
            if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
            uint32_t tm = millis();
            if (downloadToFile(FFat, manifestUrl, kManifestTmpPath) &&
                manifestFileValid(FFat, kManifestTmpPath)) {
                haveNewManifest = true;
                BacDebug::eventf("assets", "manifest dl %lu ms", (unsigned long)(millis() - tm));
                if (FFat.exists(kManifestPath) && manifestFileValid(FFat, kManifestPath)) {
                    uint32_t changed = 0, deleted = 0, newCount = 0;
                    if (diffCount(FFat, kManifestPath, kManifestTmpPath, changed, deleted, newCount)) {
                        BacDebug::eventf("assets", "diff changed=%lu deleted=%lu total=%lu",
                                         (unsigned long)changed, (unsigned long)deleted,
                                         (unsigned long)newCount);
                        if (changed == 0 && deleted == 0) {
                            ok = true;
                            didDiff = true;
                        } else if ((uint64_t)changed * 2 < (uint64_t)newCount) {
                            FFat.remove(kMarkerPath);
                            uint32_t td = millis();
                            ok = applyDiff(FFat, url, kManifestPath, kManifestTmpPath, changed, progress, ctx);
                            BacDebug::eventf("assets", "diff apply %lu ms ok=%d",
                                             (unsigned long)(millis() - td), ok ? 1 : 0);
                            didDiff = ok;
                        } else {
                            BacDebug::event("assets", "diff too large, full install");
                        }
                    }
                } else {
                    BacDebug::event("assets", "no local manifest, full install");
                }
            } else {
                BacDebug::event("assets", "manifest unavailable, full install");
                if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
            }
        }

        if (!didDiff) {
            if (!prefreeForFullInstall()) {
                BacDebug::event("assets", "prefree failed");
                if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
                FFat.end();
                lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
                return false;
            }
            haveNewManifest = false;
            if (manifestUrl && manifestUrl[0]) {
                if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
                uint32_t tm = millis();
                if (downloadToFile(FFat, manifestUrl, kManifestTmpPath) &&
                    manifestFileValid(FFat, kManifestTmpPath)) {
                    haveNewManifest = true;
                    BacDebug::eventf("assets", "manifest dl %lu ms", (unsigned long)(millis() - tm));
                }
            }
            BacDebug::eventf("assets", "full install %s", url);
            uint32_t tInstall = millis();
            ok = streamInstall(url, expectedSize, expectedSha256, FFat, progress, ctx, shaMismatch, kAssetsDir);
            BacDebug::eventf("assets", "install %lu ms (%lu KB/s)", (unsigned long)(millis() - tInstall),
                             (millis() - tInstall) > 0
                                 ? (unsigned long)((uint64_t)expectedSize / (millis() - tInstall))
                                 : 0UL);
            if (ok) {
                if (haveNewManifest) replaceManifest(FFat);
                writeMarker(FFat, version);
            }
            if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
        } else {
            if (ok) {
                if (haveNewManifest) replaceManifest(FFat);
                writeMarker(FFat, version);
            }
            if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
        }

        BacDebug::event("assets", ok ? "install ok" : "install failed");
        FFat.end();
        return ok;
    }

    static bool installPackFromBuffer(const uint8_t *data, uint32_t expectedSize, const char *expectedSha256,
                                      ProgressFn progress, void *ctx, bool *shaMismatch = nullptr,
                                      const char *version = nullptr, const uint8_t *manifestData = nullptr,
                                      uint32_t manifestSize = 0, bool keepLucarneUnmounted = false) {
        if (!data || !expectedSha256 || strlen(expectedSha256) != 64 || expectedSize == 0) {
            BacDebug::event("assets", "invalid buffer install args");
            return false;
        }

        lucarne::unmountVolume();
        if (!FFat.begin(false, "/ffat", 10, "ffat")) {
            BacDebug::event("assets", "ffat mount failed");
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            return false;
        }

        removeLegacyStaging(FFat);

        if (keepLucarneUnmounted) {
            if (!prefreeForUsbInstall(FFat, progress, ctx)) {
                BacDebug::event("assets", "prefree failed");
                if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
                FFat.end();
                return false;
            }
        } else if (!prefreeForFullInstall()) {
            BacDebug::event("assets", "prefree failed");
            if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
            FFat.end();
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            return false;
        }

        bool haveNewManifest = false;
        if (manifestData && manifestSize > 0 && manifestBufferValid(manifestData, manifestSize)) {
            File out = FFat.open(kManifestTmpPath, FILE_WRITE);
            if (out) {
                size_t wrote = out.write(manifestData, manifestSize);
                out.close();
                if (wrote == manifestSize) haveNewManifest = true;
            }
        }

        BacDebug::event("assets", "usb buffer install");
        uint32_t tInstall = millis();
        bool ok = bufferInstall(data, expectedSize, expectedSha256, FFat, progress, ctx, shaMismatch, kAssetsDir);
        BacDebug::eventf("assets", "install %lu ms", (unsigned long)(millis() - tInstall));
        if (ok) {
            if (haveNewManifest) replaceManifest(FFat);
            writeMarker(FFat, version);
        }
        if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);

        BacDebug::event("assets", ok ? "install ok" : "install failed");
        FFat.end();
        if (!keepLucarneUnmounted) {
            if (!lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat")) {
                BacDebug::event("assets", "volume remount failed");
            }
        }
        return ok;
    }

    static bool bootIntegrityCheck() {
        bool mounted = lucarne::volumeMounted();
        if (!mounted) {
            if (!FFat.begin(false, "/ffat", 10, "ffat")) return false;
        }
        reconcileStaging(FFat);
        bool healthy = FFat.exists(kMarkerPath);
        if (!healthy) {
            BacDebug::event("assets", "boot marker missing, forcing full reinstall");
            if (FFat.exists(kManifestPath)) FFat.remove(kManifestPath);
        }
        if (!mounted) FFat.end();
        return healthy;
    }

    // Returns true when the completion marker exists, meaning the last assets install
    // finished and verified. A missing marker means an interrupted or failed install.
    static bool markerPresent() {
        bool mounted = lucarne::volumeMounted();
        if (!mounted) {
            if (!FFat.begin(false, "/ffat", 10, "ffat")) return false;
        }
        bool present = FFat.exists(kMarkerPath);
        if (!mounted) FFat.end();
        return present;
    }

    static bool manifestBufferValid(const uint8_t *data, uint32_t size) {
        if (!data || size < 12) return false;
        if (data[0] != 'B' || data[1] != 'A' || data[2] != 'C' || data[3] != 'X') return false;
        return readLe32(data + 4) == 1;
    }

private:
    static void removeLegacyStaging(fs::FS &fs) {
        if (fs.exists(kLegacyStagingPath)) fs.remove(kLegacyStagingPath);
    }

    static uint16_t readLe16(const uint8_t *b) {
        return (uint16_t)b[0] | ((uint16_t)b[1] << 8);
    }

    static uint32_t readLe32(const uint8_t *b) {
        return (uint32_t)b[0] | ((uint32_t)b[1] << 8) | ((uint32_t)b[2] << 16) | ((uint32_t)b[3] << 24);
    }

    static bool readExact(Stream &stream, HTTPClient &http, uint8_t *buf, size_t len) {
        size_t got = 0;
        uint32_t started = millis();
        while (got < len) {
            BacWatchdog::feed();
            if (stream.available()) {
                int n = stream.readBytes(buf + got, len - got);
                if (n <= 0) return false;
                got += (size_t)n;
                started = millis();
                continue;
            }
            if (!http.connected() && !stream.available()) return false;
            if (millis() - started > 300000) return false;
            delay(1);
        }
        return true;
    }

    static bool readHashed(Stream &stream, HTTPClient &http, uint8_t *buf, size_t len, BacSha256 &sha) {
        if (!readExact(stream, http, buf, len)) return false;
        sha.update(buf, len);
        return true;
    }

    // ---- Differential sync (manifest + HTTP Range) ----

    struct ManifestReader {
        File f;
        uint32_t count = 0;
        uint32_t index = 0;

        bool open(fs::FS &fs, const char *path) {
            f = fs.open(path);
            if (!f) return false;
            uint8_t h[12];
            if (f.read(h, 12) != 12) {
                f.close();
                return false;
            }
            if (h[0] != 'B' || h[1] != 'A' || h[2] != 'C' || h[3] != 'X') {
                f.close();
                return false;
            }
            uint32_t ver = readLe32(h + 4);
            count = readLe32(h + 8);
            return ver == 1;
        }

        // 1 = entry read, 0 = end reached, -1 = error
        int next(ManifestEntry &e) {
            if (index >= count) return 0;
            uint8_t lb[2];
            if (f.read(lb, 2) != 2) return -1;
            e.pathLen = readLe16(lb);
            if (e.pathLen == 0 || e.pathLen >= sizeof(e.path)) return -1;
            if (f.read((uint8_t *)e.path, e.pathLen) != (size_t)e.pathLen) return -1;
            e.path[e.pathLen] = 0;
            uint8_t sb[4];
            if (f.read(sb, 4) != 4) return -1;
            e.size = readLe32(sb);
            uint8_t ob[4];
            if (f.read(ob, 4) != 4) return -1;
            e.recordOffset = readLe32(ob);
            if (f.read(e.sha, 32) != 32) return -1;
            index++;
            return 1;
        }

        void close() {
            if (f) f.close();
        }
    };

    static bool manifestFileValid(fs::FS &fs, const char *path) {
        File f = fs.open(path);
        if (!f) return false;
        uint8_t h[12];
        size_t n = f.read(h, 12);
        f.close();
        if (n != 12) return false;
        if (h[0] != 'B' || h[1] != 'A' || h[2] != 'C' || h[3] != 'X') return false;
        return readLe32(h + 4) == 1;
    }

    struct BufferReader {
        const uint8_t *data;
        size_t len;
        size_t pos;

        bool read(uint8_t *buf, size_t n) {
            if (pos + n > len) return false;
            memcpy(buf, data + pos, n);
            pos += n;
            return true;
        }
    };

    static bool readHashedBuf(BufferReader &reader, uint8_t *buf, size_t len, BacSha256 &sha) {
        if (!reader.read(buf, len)) return false;
        sha.update(buf, len);
        return true;
    }

    static bool bufferInstall(const uint8_t *data, uint32_t expectedSize, const char *expectedSha256, fs::FS &fs,
                              ProgressFn progress, void *ctx, bool *shaMismatch, const char *destRoot = kAssetsDir) {
        BufferReader reader = {data, expectedSize, 0};
        BacSha256 sha;
        sha.begin();
        size_t consumed = 0;
        uint32_t readMs = 0, writeMs = 0, openMs = 0;

        uint8_t header[12];
        if (!readHashedBuf(reader, header, 12, sha)) {
            BacDebug::event("assets", "header read failed");
            return false;
        }
        consumed += 12;
        if (header[0] != 'B' || header[1] != 'A' || header[2] != 'C' || header[3] != 'A') {
            BacDebug::event("assets", "bad magic");
            return false;
        }
        uint32_t formatVersion = readLe32(header + 4);
        uint32_t fileCount = readLe32(header + 8);
        if (formatVersion != 1 || fileCount == 0) {
            BacDebug::event("assets", "bad pack header");
            return false;
        }

        uint8_t buf[kBufSize];
        for (uint32_t i = 0; i < fileCount; i++) {
            if (i == 0 || ((i + 1) % 32) == 0 || i + 1 == fileCount) {
                BacDebug::eventf("assets", "install %lu/%lu", (unsigned long)(i + 1), (unsigned long)fileCount);
            }
            BacWatchdog::feed();
            delay(1);
            uint8_t lenBytes[2];
            if (!readHashedBuf(reader, lenBytes, 2, sha)) {
                BacDebug::eventf("assets", "read path len failed file %lu", (unsigned long)i);
                return false;
            }
            consumed += 2;
            uint16_t pathLen = readLe16(lenBytes);
            if (pathLen == 0 || pathLen >= 192) {
                BacDebug::eventf("assets", "bad path len file %lu", (unsigned long)i);
                return false;
            }
            char path[192];
            if (!readHashedBuf(reader, (uint8_t *)path, pathLen, sha)) {
                BacDebug::eventf("assets", "read path failed file %lu", (unsigned long)i);
                return false;
            }
            path[pathLen] = 0;
            consumed += pathLen;
            if (!isSafeAssetPath(path)) {
                BacDebug::eventf("assets", "unsafe path %s", path);
                return false;
            }
            char remapped[200];
            const char *writePath = path;
            if (destRoot && strcmp(destRoot, kAssetsDir) != 0) {
                snprintf(remapped, sizeof(remapped), "%s%s", destRoot, path + strlen(kAssetsDir));
                writePath = remapped;
            }
            uint8_t sizeBytes[4];
            if (!readHashedBuf(reader, sizeBytes, 4, sha)) {
                BacDebug::eventf("assets", "read size failed %s", path);
                return false;
            }
            consumed += 4;
            uint32_t size = readLe32(sizeBytes);
            if (!ensureParentDirs(fs, writePath)) return false;
            uint32_t tOpen = millis();
            File out = fs.open(writePath, FILE_WRITE);
            openMs += millis() - tOpen;
            if (!out) {
                BacDebug::eventf("assets", "open failed %s", path);
                return false;
            }
            uint32_t remaining = size;
            while (remaining > 0) {
                size_t chunk = remaining > kBufSize ? kBufSize : remaining;
                uint32_t tRead = millis();
                bool readOk = readHashedBuf(reader, buf, chunk, sha);
                readMs += millis() - tRead;
                if (!readOk) {
                    out.close();
                    BacDebug::eventf("assets", "read body failed %s", path);
                    return false;
                }
                uint32_t tWrite = millis();
                size_t wrote = out.write(buf, chunk);
                writeMs += millis() - tWrite;
                if (wrote != chunk) {
                    out.close();
                    BacDebug::eventf("assets", "write failed %s", writePath);
                    return false;
                }
                remaining -= (uint32_t)chunk;
                consumed += chunk;
                if ((consumed & 0x3FFF) == 0) {
                    BacWatchdog::feed();
                    delay(1);
                }
                if (progress && expectedSize > 0) {
                    int pct = (int)((consumed * 100ULL) / expectedSize);
                    if (pct > 100) pct = 100;
                    progress(ctx, pct);
                }
            }
            uint32_t tClose = millis();
            out.close();
            openMs += millis() - tClose;
        }

        BacDebug::eventf("assets", "timing read=%lums write=%lums open=%lums", (unsigned long)readMs,
                         (unsigned long)writeMs, (unsigned long)openMs);

        if (consumed != (size_t)expectedSize) {
            BacDebug::eventf("assets", "short read %u/%lu", (unsigned)consumed, (unsigned long)expectedSize);
            return false;
        }
        char gotSha[65];
        if (!sha.finishHex(gotSha) || !BacSha256::equalsHex(expectedSha256, gotSha)) {
            BacDebug::eventf("assets", "sha256 mismatch got=%s", gotSha);
            if (shaMismatch) *shaMismatch = true;
            return false;
        }
        BacDebug::eventf("assets", "ok %lu files %u bytes", (unsigned long)fileCount, (unsigned)consumed);
        return true;
    }

    static bool downloadToFile(fs::FS &fs, const char *url, const char *dest) {
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(60000);
        if (!http.begin(client, url)) return false;
        http.addHeader("Accept-Encoding", "identity");
        int code = http.GET();
        if (code != 200) {
            BacDebug::eventf("assets", "manifest http %d", code);
            http.end();
            return false;
        }
        int len = http.getSize();
        WiFiClient *stream = http.getStreamPtr();
        if (!stream) {
            http.end();
            return false;
        }
        File out = fs.open(dest, FILE_WRITE);
        if (!out) {
            http.end();
            return false;
        }
        uint8_t buf[1024];
        size_t total = 0;
        uint32_t started = millis();
        while (len < 0 || total < (size_t)len) {
            BacWatchdog::feed();
            if (stream->available()) {
                int n = stream->readBytes(buf, sizeof(buf));
                if (n <= 0) {
                    if (!http.connected()) break;
                    delay(1);
                    continue;
                }
                if (out.write(buf, (size_t)n) != (size_t)n) {
                    out.close();
                    http.end();
                    return false;
                }
                total += (size_t)n;
                started = millis();
                continue;
            }
            if (!http.connected()) break;
            if (millis() - started > 60000) break;
            delay(1);
        }
        out.close();
        http.end();
        if (len > 0 && total != (size_t)len) return false;
        return total > 0;
    }

    static bool diffCount(fs::FS &fs, const char *localPath, const char *newPath, uint32_t &changed,
                          uint32_t &deleted, uint32_t &newCount) {
        ManifestReader L, N;
        if (!N.open(fs, newPath)) return false;
        if (!L.open(fs, localPath)) {
            N.close();
            return false;
        }
        newCount = N.count;
        changed = 0;
        deleted = 0;
        ManifestEntry le, ne;
        int hl = L.next(le);
        int hn = N.next(ne);
        while (hn == 1 || hl == 1) {
            if (hn == 1 && (hl != 1 || strcmp(ne.path, le.path) < 0)) {
                changed++;
                hn = N.next(ne);
            } else if (hl == 1 && (hn != 1 || strcmp(le.path, ne.path) < 0)) {
                deleted++;
                hl = L.next(le);
            } else {
                if (memcmp(le.sha, ne.sha, 32) != 0) changed++;
                hl = L.next(le);
                hn = N.next(ne);
            }
        }
        L.close();
        N.close();
        return hl != -1 && hn != -1;
    }

    static bool fetchRunRange(fs::FS &fs, const char *packUrl, ManifestEntry *run, int runCount) {
        if (runCount <= 0) return true;
        uint32_t start = run[0].recordOffset;
        ManifestEntry &last = run[runCount - 1];
        uint32_t end = last.recordOffset + 6 + last.pathLen + last.size;
        uint32_t rangeLen = end - start;

        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(120000);
        if (!http.begin(client, packUrl)) {
            BacDebug::event("assets", "range begin fail");
            return false;
        }
        http.addHeader("Accept-Encoding", "identity");
        char range[48];
        snprintf(range, sizeof(range), "bytes=%lu-%lu", (unsigned long)start, (unsigned long)(end - 1));
        http.addHeader("Range", range);
        int code = http.GET();
        if (code != 206) {
            BacDebug::eventf("assets", "range http %d", code);
            http.end();
            return false;
        }
        int clen = http.getSize();
        if (clen > 0 && (uint32_t)clen != rangeLen) {
            BacDebug::eventf("assets", "range clen %d != %lu", clen, (unsigned long)rangeLen);
            http.end();
            return false;
        }
        WiFiClient *stream = http.getStreamPtr();
        if (!stream) {
            http.end();
            return false;
        }

        uint8_t buf[kBufSize];
        for (int i = 0; i < runCount; i++) {
            uint8_t lb[2];
            if (!readExact(*stream, http, lb, 2)) {
                http.end();
                return false;
            }
            uint16_t pathLen = readLe16(lb);
            if (pathLen != run[i].pathLen) {
                BacDebug::event("assets", "range pathlen mismatch");
                http.end();
                return false;
            }
            char path[192];
            if (!readExact(*stream, http, (uint8_t *)path, pathLen)) {
                http.end();
                return false;
            }
            path[pathLen] = 0;
            if (strcmp(path, run[i].path) != 0 || !isSafeAssetPath(path)) {
                BacDebug::eventf("assets", "range path mismatch %s", path);
                http.end();
                return false;
            }
            uint8_t sb[4];
            if (!readExact(*stream, http, sb, 4)) {
                http.end();
                return false;
            }
            uint32_t size = readLe32(sb);
            if (size != run[i].size) {
                BacDebug::event("assets", "range size mismatch");
                http.end();
                return false;
            }
            if (!ensureParentDirs(fs, path)) {
                http.end();
                return false;
            }
            File out = fs.open(path, FILE_WRITE);
            if (!out) {
                BacDebug::eventf("assets", "range open fail %s", path);
                http.end();
                return false;
            }
            BacSha256 sh;
            sh.begin();
            uint32_t remaining = size;
            while (remaining > 0) {
                size_t chunk = remaining > kBufSize ? kBufSize : remaining;
                if (!readExact(*stream, http, buf, chunk)) {
                    out.close();
                    http.end();
                    return false;
                }
                sh.update(buf, chunk);
                if (out.write(buf, chunk) != chunk) {
                    out.close();
                    http.end();
                    BacDebug::eventf("assets", "range write fail %s", path);
                    return false;
                }
                remaining -= (uint32_t)chunk;
            }
            out.close();
            uint8_t got[32];
            if (!sh.finishRaw(got) || memcmp(got, run[i].sha, 32) != 0) {
                BacDebug::eventf("assets", "range sha mismatch %s", path);
                http.end();
                return false;
            }
        }
        http.end();
        return true;
    }

    static bool flushRun(fs::FS &fs, const char *packUrl, ManifestEntry *run, int &runCount) {
        if (runCount == 0) return true;
        bool ok = fetchRunRange(fs, packUrl, run, runCount);
        runCount = 0;
        return ok;
    }

    static bool appendRun(fs::FS &fs, const char *packUrl, ManifestEntry *run, int &runCount,
                          const ManifestEntry &e) {
        if (runCount > 0) {
            ManifestEntry &prev = run[runCount - 1];
            uint32_t runEnd = prev.recordOffset + 6 + prev.pathLen + prev.size;
            if (e.recordOffset != runEnd || runCount >= kMaxRun) {
                if (!flushRun(fs, packUrl, run, runCount)) return false;
            }
        }
        run[runCount++] = e;
        return true;
    }

    static bool applyDiff(fs::FS &fs, const char *packUrl, const char *localPath, const char *newPath,
                          uint32_t changedTotal, ProgressFn progress, void *ctx) {
        ManifestReader L, N;
        if (!N.open(fs, newPath) || !L.open(fs, localPath)) {
            L.close();
            N.close();
            return false;
        }
        ManifestEntry *run = (ManifestEntry *)malloc(sizeof(ManifestEntry) * kMaxRun);
        if (!run) {
            L.close();
            N.close();
            return false;
        }
        int runCount = 0;
        uint32_t processed = 0;
        bool ok = true;
        ManifestEntry le, ne;
        int hl = L.next(le);
        int hn = N.next(ne);
        while (ok && (hn == 1 || hl == 1)) {
            if (hn == 1 && (hl != 1 || strcmp(ne.path, le.path) < 0)) {
                if (!appendRun(fs, packUrl, run, runCount, ne)) {
                    ok = false;
                    break;
                }
                reportProgress(progress, ctx, ++processed, changedTotal);
                hn = N.next(ne);
            } else if (hl == 1 && (hn != 1 || strcmp(le.path, ne.path) < 0)) {
                if (isSafeAssetPath(le.path)) fs.remove(le.path);
                hl = L.next(le);
            } else {
                if (memcmp(le.sha, ne.sha, 32) != 0) {
                    if (!appendRun(fs, packUrl, run, runCount, ne)) {
                        ok = false;
                        break;
                    }
                    reportProgress(progress, ctx, ++processed, changedTotal);
                }
                hl = L.next(le);
                hn = N.next(ne);
            }
        }
        if (ok && !flushRun(fs, packUrl, run, runCount)) ok = false;
        free(run);
        L.close();
        N.close();
        if (hl == -1 || hn == -1) ok = false;
        return ok;
    }

    static void reportProgress(ProgressFn progress, void *ctx, uint32_t processed, uint32_t total) {
        if (!progress || total == 0) return;
        int pct = (int)((uint64_t)processed * 100 / total);
        if (pct > 100) pct = 100;
        progress(ctx, pct);
    }

    static bool replaceManifest(fs::FS &fs) {
        if (!fs.exists(kManifestTmpPath)) return false;
        if (!fs.exists("/assets")) fs.mkdir("/assets");
        if (fs.exists(kManifestPath)) fs.remove(kManifestPath);
        if (fs.rename(kManifestTmpPath, kManifestPath)) return true;
        // Rename can fail across the root/subdir boundary on some FAT builds; copy instead.
        File in = fs.open(kManifestTmpPath);
        if (!in) return false;
        File out = fs.open(kManifestPath, FILE_WRITE);
        if (!out) {
            in.close();
            return false;
        }
        uint8_t buf[1024];
        size_t n;
        while ((n = in.read(buf, sizeof(buf))) > 0) {
            if (out.write(buf, n) != n) {
                in.close();
                out.close();
                return false;
            }
        }
        in.close();
        out.close();
        fs.remove(kManifestTmpPath);
        return true;
    }

    // Recursively lists a directory tree, mirroring BacSysInfo::collectVolumeStats
    // which is the traversal pattern proven reliable on this FatFs: the parent
    // handle stays open while children are reopened by path. This is READ-ONLY on
    // purpose; deletion happens afterwards by path so we never delete an entry
    // while a directory is being iterated (which corrupts openNextFile on FAT and
    // was returning empty listings for deep subdirs). Files are appended to
    // outFiles, directories to outDirs in pre-order (parent before child).
    static void listTree(fs::FS &fs, const char *path, String &outFiles, String &outDirs) {
        File dir = fs.open(path);
        if (!dir || !dir.isDirectory()) {
            if (dir) dir.close();
            return;
        }
        File entry;
        while ((entry = dir.openNextFile())) {
            String name = entry.name();
            bool isDir = entry.isDirectory();
            String child = String(path);
            if (name.startsWith("/")) {
                child = name;
            } else {
                if (!child.endsWith("/")) child += "/";
                child += name;
            }
            if (isDir) {
                outDirs += child;
                outDirs += "\n";
                listTree(fs, child.c_str(), outFiles, outDirs);
            } else {
                outFiles += child;
                outFiles += "\n";
            }
            entry.close();
        }
        dir.close();
    }

    static bool removeListedFiles(fs::FS &fs, const String &files, ProgressFn progress = nullptr, void *ctx = nullptr,
                                  int pctLo = -1, int pctHi = -1) {
        int start = 0;
        int removed = 0;
        int total = 0;
        if (progress && pctLo >= 0 && pctHi > pctLo) {
            for (int i = 0; i < (int)files.length(); i++) {
                if (files.charAt(i) == '\n') total++;
            }
        }
        while (start < (int)files.length()) {
            BacWatchdog::feed();
            int nl = files.indexOf('\n', start);
            if (nl < 0) break;
            String p = files.substring(start, nl);
            start = nl + 1;
            if (p.length() == 0) continue;
            if (!fs.remove(p.c_str())) {
                BacDebug::eventf("assets", "rm fail %s", p.c_str());
                return false;
            }
            removed++;
            if ((removed & 0x3F) == 0) delay(1);
            if (progress && total > 0 && pctHi > pctLo && (removed & 0xF) == 0) {
                int pct = pctLo + ((pctHi - pctLo) * removed) / total;
                if (pct > pctHi) pct = pctHi;
                progress(ctx, pct);
            }
        }
        return true;
    }

    // Removes directories deepest-first. outDirs is pre-order (parent before
    // child), so iterating from the end yields child before parent. rmdir failures
    // are logged but tolerated: an empty leftover directory is harmless and the
    // stream install writes straight into /assets regardless.
    static void removeListedDirs(fs::FS &fs, const String &dirs) {
        int end = dirs.length();
        while (end > 0) {
            int nl = dirs.lastIndexOf('\n', end - 1);
            String p = dirs.substring(nl + 1, end);
            end = nl;
            p.trim();
            if (p.length() == 0) continue;
            if (!fs.rmdir(p.c_str())) {
                BacDebug::eventf("assets", "rmdir skip %s", p.c_str());
            }
        }
    }

    static bool removeTree(fs::FS &fs, const char *root, ProgressFn progress = nullptr, void *ctx = nullptr,
                           int pctLo = -1, int pctHi = -1) {
        if (!fs.exists(root)) return true;
        File dir = fs.open(root);
        if (!dir) return false;
        if (!dir.isDirectory()) {
            dir.close();
            return fs.remove(root);
        }
        dir.close();
        String files;
        String dirs;
        listTree(fs, root, files, dirs);
        if (!removeListedFiles(fs, files, progress, ctx, pctLo, pctHi)) return false;
        removeListedDirs(fs, dirs);
        return fs.rmdir(root);
    }

    static bool swapStagingIntoAssets(fs::FS &fs) {
        if (!fs.exists(kStagingDir)) return false;
        if (fs.exists(kAssetsDir)) {
            removeTree(fs, kBackupDir);
            if (!fs.rename(kAssetsDir, kBackupDir)) {
                BacDebug::event("assets", "swap backup rename failed");
                return false;
            }
        }
        if (!fs.rename(kStagingDir, kAssetsDir)) {
            BacDebug::event("assets", "swap promote rename failed");
            if (!fs.exists(kAssetsDir) && fs.exists(kBackupDir)) fs.rename(kBackupDir, kAssetsDir);
            return false;
        }
        removeTree(fs, kBackupDir);
        return true;
    }

    static bool prefreeForUsbInstall(fs::FS &fs, ProgressFn progress = nullptr, void *ctx = nullptr) {
        BacDebug::event("assets", "prefree usb wipe");
        if (progress) progress(ctx, 0);
        if (fs.exists(kMarkerPath)) fs.remove(kMarkerPath);
        if (fs.exists(kManifestPath)) fs.remove(kManifestPath);
        if (fs.exists(kManifestTmpPath)) fs.remove(kManifestTmpPath);
        removeTree(fs, kStagingDir);
        removeTree(fs, kBackupDir);
        if (fs.exists(kAssetsDir)) {
            if (progress) progress(ctx, 1);
            if (!removeTree(fs, kAssetsDir, progress, ctx, 1, 9)) return false;
        }
        if (progress) progress(ctx, 9);
        return true;
    }

    static bool prefreeForFullInstall() {
        BacDebug::event("assets", "prefree format");
        FFat.end();
        if (!FFat.format()) {
            BacDebug::event("assets", "prefree format failed");
            if (!FFat.begin(false, "/ffat", 10, "ffat")) return false;
            return false;
        }
        if (!FFat.begin(false, "/ffat", 10, "ffat")) {
            BacDebug::event("assets", "prefree remount failed");
            return false;
        }
        return true;
    }

    static void reconcileStaging(fs::FS &fs) {
        if (fs.exists(kStagingDir)) {
            if (fs.exists(kStagingMarkerPath)) {
                removeTree(fs, kAssetsDir);
                if (fs.rename(kStagingDir, kAssetsDir)) {
                    BacDebug::event("assets", "staging promoted at boot");
                } else {
                    BacDebug::event("assets", "staging promote failed at boot");
                }
            } else {
                removeTree(fs, kStagingDir);
                BacDebug::event("assets", "incomplete staging cleared");
            }
        }
        if (fs.exists(kBackupDir)) {
            if (!fs.exists(kAssetsDir)) {
                if (fs.rename(kBackupDir, kAssetsDir)) {
                    BacDebug::event("assets", "restored backup at boot");
                }
            } else {
                removeTree(fs, kBackupDir);
            }
        }
    }

    static bool isSafeAssetPath(const char *path) {
        if (!path || strncmp(path, "/assets/", 8) != 0) return false;
        if (strstr(path, "..") != nullptr) return false;
        return true;
    }

    static bool ensureParentDirs(fs::FS &fs, const char *filePath) {
        String path = filePath;
        int last = path.lastIndexOf('/');
        if (last <= 0) return true;
        String dir = path.substring(0, last);
        if (dir.length() == 0 || dir == "/") return true;
        if (fs.exists(dir.c_str())) return true;

        String built = "";
        int start = dir.charAt(0) == '/' ? 1 : 0;
        int from = start;
        while (from <= dir.length()) {
            int slash = dir.indexOf('/', from);
            String segment;
            if (slash < 0) {
                segment = dir.substring(from);
                from = dir.length() + 1;
            } else {
                segment = dir.substring(from, slash);
                from = slash + 1;
            }
            if (segment.length() == 0) continue;
            if (built.length()) built += "/";
            else if (dir.charAt(0) == '/') built = "/";
            built += segment;
            if (!fs.exists(built.c_str())) {
                if (!fs.mkdir(built.c_str())) {
                    BacDebug::eventf("assets", "mkdir failed %s", built.c_str());
                    return false;
                }
            }
        }
        return true;
    }

    static void writeMarker(fs::FS &fs, const char *version) {
        writeMarkerAt(fs, kMarkerPath, version);
    }

    static void writeMarkerAt(fs::FS &fs, const char *path, const char *version) {
        File f = fs.open(path, FILE_WRITE);
        if (!f) return;
        f.print(version && version[0] ? version : "1");
        f.close();
    }

    static bool stageManifest(fs::FS &fs) {
        if (!fs.exists(kManifestTmpPath)) return false;
        if (fs.exists(kStagingManifestPath)) fs.remove(kStagingManifestPath);
        File in = fs.open(kManifestTmpPath);
        if (!in) return false;
        File out = fs.open(kStagingManifestPath, FILE_WRITE);
        if (!out) {
            in.close();
            return false;
        }
        uint8_t buf[1024];
        size_t n;
        while ((n = in.read(buf, sizeof(buf))) > 0) {
            if (out.write(buf, n) != n) {
                in.close();
                out.close();
                return false;
            }
        }
        in.close();
        out.close();
        return true;
    }

    static bool streamInstall(const char *url, uint32_t expectedSize, const char *expectedSha256, fs::FS &fs,
                              ProgressFn progress, void *ctx, bool *shaMismatch, const char *destRoot = kAssetsDir) {
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(300000);
        if (!http.begin(client, url)) {
            BacDebug::event("assets", "http begin failed");
            return false;
        }
        http.addHeader("Accept-Encoding", "identity");
        int code = http.GET();
        if (code != 200) {
            BacDebug::eventf("assets", "http %d", code);
            http.end();
            return false;
        }
        int len = http.getSize();
        if (len <= 0 || (uint32_t)len != expectedSize) {
            BacDebug::eventf("assets", "size mismatch got=%d expected=%lu", len, (unsigned long)expectedSize);
            http.end();
            return false;
        }
        WiFiClient *stream = http.getStreamPtr();
        if (!stream) {
            BacDebug::event("assets", "no stream");
            http.end();
            return false;
        }

        BacSha256 sha;
        sha.begin();
        size_t consumed = 0;
        uint32_t readMs = 0, writeMs = 0, openMs = 0;

        uint8_t header[12];
        if (!readHashed(*stream, http, header, 12, sha)) {
            http.end();
            BacDebug::event("assets", "header read failed");
            return false;
        }
        consumed += 12;
        if (header[0] != 'B' || header[1] != 'A' || header[2] != 'C' || header[3] != 'A') {
            http.end();
            BacDebug::event("assets", "bad magic");
            return false;
        }
        uint32_t formatVersion = readLe32(header + 4);
        uint32_t fileCount = readLe32(header + 8);
        if (formatVersion != 1 || fileCount == 0) {
            http.end();
            BacDebug::event("assets", "bad pack header");
            return false;
        }

        uint8_t buf[kBufSize];
        for (uint32_t i = 0; i < fileCount; i++) {
            if (i == 0 || ((i + 1) % 32) == 0 || i + 1 == fileCount) {
                BacDebug::eventf("assets", "install %lu/%lu", (unsigned long)(i + 1), (unsigned long)fileCount);
            }
            uint8_t lenBytes[2];
            if (!readHashed(*stream, http, lenBytes, 2, sha)) {
                http.end();
                BacDebug::eventf("assets", "read path len failed file %lu", (unsigned long)i);
                return false;
            }
            consumed += 2;
            uint16_t pathLen = readLe16(lenBytes);
            if (pathLen == 0 || pathLen >= 192) {
                http.end();
                BacDebug::eventf("assets", "bad path len file %lu", (unsigned long)i);
                return false;
            }
            char path[192];
            if (!readHashed(*stream, http, (uint8_t *)path, pathLen, sha)) {
                http.end();
                BacDebug::eventf("assets", "read path failed file %lu", (unsigned long)i);
                return false;
            }
            path[pathLen] = 0;
            consumed += pathLen;
            if (!isSafeAssetPath(path)) {
                http.end();
                BacDebug::eventf("assets", "unsafe path %s", path);
                return false;
            }
            char remapped[200];
            const char *writePath = path;
            if (destRoot && strcmp(destRoot, kAssetsDir) != 0) {
                snprintf(remapped, sizeof(remapped), "%s%s", destRoot, path + strlen(kAssetsDir));
                writePath = remapped;
            }
            uint8_t sizeBytes[4];
            if (!readHashed(*stream, http, sizeBytes, 4, sha)) {
                http.end();
                BacDebug::eventf("assets", "read size failed %s", path);
                return false;
            }
            consumed += 4;
            uint32_t size = readLe32(sizeBytes);
            if (!ensureParentDirs(fs, writePath)) {
                http.end();
                return false;
            }
            uint32_t tOpen = millis();
            File out = fs.open(writePath, FILE_WRITE);
            openMs += millis() - tOpen;
            if (!out) {
                http.end();
                BacDebug::eventf("assets", "open failed %s", path);
                return false;
            }
            uint32_t remaining = size;
            while (remaining > 0) {
                size_t chunk = remaining > kBufSize ? kBufSize : remaining;
                uint32_t tRead = millis();
                bool readOk = readHashed(*stream, http, buf, chunk, sha);
                readMs += millis() - tRead;
                if (!readOk) {
                    out.close();
                    http.end();
                    BacDebug::eventf("assets", "read body failed %s", path);
                    return false;
                }
                uint32_t tWrite = millis();
                size_t wrote = out.write(buf, chunk);
                writeMs += millis() - tWrite;
                if (wrote != chunk) {
                    out.close();
                    http.end();
                    BacDebug::eventf("assets", "write failed %s", writePath);
                    return false;
                }
                remaining -= (uint32_t)chunk;
                consumed += chunk;
                if (progress && expectedSize > 0) {
                    int pct = (int)((consumed * 100ULL) / expectedSize);
                    if (pct > 100) pct = 100;
                    progress(ctx, pct);
                }
            }
            uint32_t tClose = millis();
            out.close();
            openMs += millis() - tClose;
        }
        http.end();
        BacDebug::eventf("assets", "timing read=%lums write=%lums open=%lums", (unsigned long)readMs,
                         (unsigned long)writeMs, (unsigned long)openMs);

        if (consumed != (size_t)expectedSize) {
            BacDebug::eventf("assets", "short read %u/%lu", (unsigned)consumed, (unsigned long)expectedSize);
            return false;
        }
        char gotSha[65];
        if (!sha.finishHex(gotSha) || !BacSha256::equalsHex(expectedSha256, gotSha)) {
            BacDebug::eventf("assets", "sha256 mismatch got=%s", gotSha);
            if (shaMismatch) *shaMismatch = true;
            return false;
        }
        BacDebug::eventf("assets", "ok %lu files %u bytes", (unsigned long)fileCount, (unsigned)consumed);
        return true;
    }
};

#else

struct BacAssetsOta {
    typedef void (*ProgressFn)(void *, int);
    static bool installPackFromUrl(const char *, uint32_t, const char *, ProgressFn, void *, bool * = nullptr,
                                   const char * = nullptr, const char * = nullptr) {
        return false;
    }
    static bool installPackFromBuffer(const uint8_t *, uint32_t, const char *, ProgressFn, void *, bool * = nullptr,
                                      const char * = nullptr, const uint8_t * = nullptr, uint32_t = 0, bool = false) {
        return false;
    }
    static bool markerPresent() { return false; }
    static bool manifestBufferValid(const uint8_t *, uint32_t) { return false; }
};

#endif
