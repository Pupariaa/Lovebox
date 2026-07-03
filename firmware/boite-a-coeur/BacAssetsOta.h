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

struct BacAssetsOta {
    typedef void (*ProgressFn)(void *ctx, int percent);
    static constexpr size_t kBufSize = 8192;
    static constexpr const char *kStagingPath = "/ota/staging.baca";

    static bool installPackFromUrl(const char *url, uint32_t expectedSize, const char *expectedSha256,
                                   ProgressFn progress, void *ctx, bool *shaMismatch = nullptr) {
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

        if (!FFat.exists("/ota")) FFat.mkdir("/ota");
        removeStaging(FFat);

        BacDebug::eventf("assets", "staging download %s", url);
        if (!downloadToStaging(url, expectedSize, expectedSha256, FFat, progress, ctx, shaMismatch)) {
            removeStaging(FFat);
            FFat.end();
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            return false;
        }

        BacDebug::event("assets", "wipe /assets");
        if (!wipeAssetsTree(FFat)) {
            BacDebug::event("assets", "wipe failed");
            removeStaging(FFat);
            FFat.end();
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            return false;
        }

        bool ok = installFromStaging(FFat, progress, ctx);
        removeStaging(FFat);
        if (ok) BacDebug::event("assets", "install ok");
        else BacDebug::event("assets", "install failed");
        FFat.end();
        return ok;
    }

private:
    static void removeStaging(fs::FS &fs) {
        if (fs.exists(kStagingPath)) fs.remove(kStagingPath);
    }

    static bool readExact(Stream &stream, HTTPClient &http, uint8_t *buf, size_t len) {
        size_t got = 0;
        uint32_t started = millis();
        while (got < len) {
            if (stream.available()) {
                int n = stream.readBytes(buf + got, len - got);
                if (n <= 0) return false;
                got += (size_t)n;
                continue;
            }
            if (!http.connected() && !stream.available()) return false;
            if (millis() - started > 300000) return false;
            delay(1);
        }
        return true;
    }

    static bool readExactFile(File &f, uint8_t *buf, size_t len) {
        size_t got = 0;
        while (got < len) {
            int n = f.read(buf + got, len - got);
            if (n <= 0) return false;
            got += (size_t)n;
        }
        return true;
    }

    static bool readU16(Stream &stream, HTTPClient &http, uint16_t &out) {
        uint8_t b[2];
        if (!readExact(stream, http, b, 2)) return false;
        out = (uint16_t)b[0] | ((uint16_t)b[1] << 8);
        return true;
    }

    static bool readU16File(File &f, uint16_t &out) {
        uint8_t b[2];
        if (!readExactFile(f, b, 2)) return false;
        out = (uint16_t)b[0] | ((uint16_t)b[1] << 8);
        return true;
    }

    static bool readU32(Stream &stream, HTTPClient &http, uint32_t &out) {
        uint8_t b[4];
        if (!readExact(stream, http, b, 4)) return false;
        out = (uint32_t)b[0] | ((uint32_t)b[1] << 8) | ((uint32_t)b[2] << 16) | ((uint32_t)b[3] << 24);
        return true;
    }

    static bool readU32File(File &f, uint32_t &out) {
        uint8_t b[4];
        if (!readExactFile(f, b, 4)) return false;
        out = (uint32_t)b[0] | ((uint32_t)b[1] << 8) | ((uint32_t)b[2] << 16) | ((uint32_t)b[3] << 24);
        return true;
    }

    static bool deleteTree(fs::FS &fs, const char *path) {
        if (!path || !path[0]) return true;
        File entry = fs.open(path);
        if (!entry) return true;
        if (entry.isDirectory()) {
            entry.close();
            File dir = fs.open(path);
            if (!dir) return false;
            File child;
            while ((child = dir.openNextFile())) {
                String name = child.name();
                child.close();
                String sub = String(path);
                if (!sub.endsWith("/")) sub += "/";
                if (name.startsWith("/")) sub = name;
                else sub += name;
                if (!deleteTree(fs, sub.c_str())) {
                    dir.close();
                    return false;
                }
            }
            dir.close();
            return fs.rmdir(path);
        }
        entry.close();
        return fs.remove(path);
    }

    static bool wipeAssetsTree(fs::FS &fs) {
        if (fs.exists("/assets")) return deleteTree(fs, "/assets");
        return true;
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

    static bool readPackHeader(Stream &stream, HTTPClient &http, uint32_t &fileCountOut) {
        uint8_t magic[4];
        if (!readExact(stream, http, magic, 4)) return false;
        if (magic[0] != 'B' || magic[1] != 'A' || magic[2] != 'C' || magic[3] != 'A') return false;
        uint32_t formatVersion = 0;
        uint32_t fileCount = 0;
        if (!readU32(stream, http, formatVersion) || !readU32(stream, http, fileCount)) return false;
        if (formatVersion != 1 || fileCount == 0) return false;
        fileCountOut = fileCount;
        return true;
    }

    static bool readPackHeaderFile(File &f, uint32_t &fileCountOut) {
        uint8_t magic[4];
        if (!readExactFile(f, magic, 4)) return false;
        if (magic[0] != 'B' || magic[1] != 'A' || magic[2] != 'C' || magic[3] != 'A') return false;
        uint32_t formatVersion = 0;
        uint32_t fileCount = 0;
        if (!readU32File(f, formatVersion) || !readU32File(f, fileCount)) return false;
        if (formatVersion != 1 || fileCount == 0) return false;
        fileCountOut = fileCount;
        return true;
    }

    static bool downloadToStaging(const char *url, uint32_t expectedSize, const char *expectedSha256, fs::FS &fs,
                                  ProgressFn progress, void *ctx, bool *shaMismatch = nullptr) {
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(300000);
        if (!http.begin(client, url)) {
            BacDebug::event("assets", "http begin failed");
            return false;
        }
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
        File out = fs.open(kStagingPath, FILE_WRITE);
        if (!out) {
            BacDebug::event("assets", "staging open failed");
            http.end();
            return false;
        }
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
            if (out.write(buf, (size_t)read) != (size_t)read) {
                out.close();
                http.end();
                BacDebug::event("assets", "staging write failed");
                return false;
            }
            total += (size_t)read;
            if (progress) {
                int pct = (int)((total * 50ULL) / (size_t)len);
                progress(ctx, pct);
            }
        }
        out.close();
        http.end();
        if (total != (size_t)len) {
            BacDebug::eventf("assets", "short read %u/%d", (unsigned)total, len);
            return false;
        }
        char gotSha[65];
        if (!sha.finishHex(gotSha) || !BacSha256::equalsHex(expectedSha256, gotSha)) {
            BacDebug::eventf("assets", "sha256 mismatch got=%s", gotSha);
            if (shaMismatch) *shaMismatch = true;
            return false;
        }
        BacDebug::eventf("assets", "staging ok %u bytes", (unsigned)total);
        return true;
    }

    static bool installFromStaging(fs::FS &fs, ProgressFn progress, void *ctx) {
        File in = fs.open(kStagingPath, FILE_READ);
        if (!in) {
            BacDebug::event("assets", "staging read failed");
            return false;
        }
        size_t totalSize = in.size();
        uint32_t fileCount = 0;
        if (!readPackHeaderFile(in, fileCount)) {
            in.close();
            BacDebug::event("assets", "invalid pack header");
            return false;
        }
        bool ok = writePackFilesFromFile(in, fileCount, totalSize, fs, progress, ctx);
        in.close();
        return ok;
    }

    static bool writePackFilesFromFile(File &in, uint32_t fileCount, size_t totalSize, fs::FS &vol, ProgressFn progress,
                                       void *ctx) {
        size_t processed = 12;
        uint8_t buf[kBufSize];
        for (uint32_t i = 0; i < fileCount; i++) {
            if (i == 0 || ((i + 1) % 32) == 0 || i + 1 == fileCount) {
                BacDebug::eventf("assets", "install %lu/%lu", (unsigned long)(i + 1), (unsigned long)fileCount);
            }
            uint16_t pathLen = 0;
            if (!readU16File(in, pathLen) || pathLen == 0 || pathLen >= 192) {
                BacDebug::eventf("assets", "bad path len file %lu", (unsigned long)i);
                return false;
            }
            char path[192];
            if (!readExactFile(in, (uint8_t *)path, pathLen)) {
                BacDebug::eventf("assets", "read path failed file %lu", (unsigned long)i);
                return false;
            }
            path[pathLen] = 0;
            processed += 2 + pathLen;
            if (!isSafeAssetPath(path)) {
                BacDebug::eventf("assets", "unsafe path %s", path);
                return false;
            }
            uint32_t size = 0;
            if (!readU32File(in, size)) {
                BacDebug::eventf("assets", "read size failed %s", path);
                return false;
            }
            processed += 4;
            if (!ensureParentDirs(vol, path)) return false;
            File out = vol.open(path, FILE_WRITE);
            if (!out) {
                BacDebug::eventf("assets", "open failed %s", path);
                return false;
            }
            uint32_t remaining = size;
            while (remaining > 0) {
                size_t chunk = remaining > kBufSize ? kBufSize : remaining;
                if (!readExactFile(in, buf, chunk)) {
                    out.close();
                    BacDebug::eventf("assets", "read body failed %s", path);
                    return false;
                }
                if (out.write(buf, chunk) != chunk) {
                    out.close();
                    BacDebug::eventf("assets", "write failed %s", path);
                    return false;
                }
                remaining -= (uint32_t)chunk;
                processed += chunk;
                if (progress && totalSize > 0) {
                    int pct = 50 + (int)((processed * 50ULL) / totalSize);
                    if (pct > 100) pct = 100;
                    progress(ctx, pct);
                }
            }
            out.close();
        }
        BacDebug::eventf("assets", "ok %lu files", (unsigned long)fileCount);
        return true;
    }
};

#else

struct BacAssetsOta {
    typedef void (*ProgressFn)(void *, int);
    static bool installPackFromUrl(const char *, uint32_t, const char *, ProgressFn, void *) { return false; }
};

#endif
