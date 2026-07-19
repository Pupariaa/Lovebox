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
    static constexpr const char *kLegacyStagingPath = "/ota/staging.baca";
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
    // fall back to the full streaming install that wipes /assets and rewrites everything.
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
            BacDebug::event("assets", "wipe /assets");
            uint32_t tWipe = millis();
            if (!wipeAssetsTree(FFat)) {
                BacDebug::event("assets", "wipe failed");
                if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
                FFat.end();
                lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
                return false;
            }
            if (!FFat.exists("/assets")) FFat.mkdir("/assets");
            BacDebug::eventf("assets", "wipe done %lu ms", (unsigned long)(millis() - tWipe));

            BacDebug::eventf("assets", "stream install %s", url);
            uint32_t tInstall = millis();
            ok = streamInstall(url, expectedSize, expectedSha256, FFat, progress, ctx, shaMismatch);
            BacDebug::eventf("assets", "install %lu ms (%lu KB/s)", (unsigned long)(millis() - tInstall),
                             (millis() - tInstall) > 0
                                 ? (unsigned long)((uint64_t)expectedSize / (millis() - tInstall))
                                 : 0UL);
        }

        if (ok) {
            if (haveNewManifest) replaceManifest(FFat);
            writeMarker(FFat, version);
            BacDebug::event("assets", "install ok");
        } else {
            if (FFat.exists(kManifestTmpPath)) FFat.remove(kManifestTmpPath);
            BacDebug::event("assets", "install failed");
        }
        FFat.end();
        return ok;
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

    static bool removeListedFiles(fs::FS &fs, const String &files) {
        int start = 0;
        while (start < (int)files.length()) {
            int nl = files.indexOf('\n', start);
            if (nl < 0) break;
            String p = files.substring(start, nl);
            start = nl + 1;
            if (p.length() == 0) continue;
            if (!fs.remove(p.c_str())) {
                BacDebug::eventf("assets", "rm fail %s", p.c_str());
                return false;
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

    // Empties /assets while keeping the root directory itself, so the stream
    // install can write straight into it without re-creating the folder.
    static bool wipeAssetsTree(fs::FS &fs) {
        if (!fs.exists("/assets")) return true;
        File dir = fs.open("/assets");
        if (!dir) {
            BacDebug::event("assets", "wipe open failed");
            return false;
        }
        if (!dir.isDirectory()) {
            dir.close();
            if (!fs.remove("/assets")) {
                BacDebug::event("assets", "wipe rm file failed");
                return false;
            }
            return true;
        }
        dir.close();

        String files;
        String dirs;
        listTree(fs, "/assets", files, dirs);
        int fileCount = 0;
        for (int i = 0; i < (int)files.length(); i++)
            if (files.charAt(i) == '\n') fileCount++;
        int dirCount = 0;
        for (int i = 0; i < (int)dirs.length(); i++)
            if (dirs.charAt(i) == '\n') dirCount++;
        BacDebug::eventf("assets", "wipe files=%d dirs=%d", fileCount, dirCount);

        if (!removeListedFiles(fs, files)) return false;
        removeListedDirs(fs, dirs);
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

    static void writeMarker(fs::FS &fs, const char *version) {
        File f = fs.open(kMarkerPath, FILE_WRITE);
        if (!f) return;
        f.print(version && version[0] ? version : "1");
        f.close();
    }

    static bool streamInstall(const char *url, uint32_t expectedSize, const char *expectedSha256, fs::FS &fs,
                              ProgressFn progress, void *ctx, bool *shaMismatch) {
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
            uint8_t sizeBytes[4];
            if (!readHashed(*stream, http, sizeBytes, 4, sha)) {
                http.end();
                BacDebug::eventf("assets", "read size failed %s", path);
                return false;
            }
            consumed += 4;
            uint32_t size = readLe32(sizeBytes);
            if (!ensureParentDirs(fs, path)) {
                http.end();
                return false;
            }
            uint32_t tOpen = millis();
            File out = fs.open(path, FILE_WRITE);
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
                    BacDebug::eventf("assets", "write failed %s", path);
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
    static bool markerPresent() { return false; }
};

#endif
