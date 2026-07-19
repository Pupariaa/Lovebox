#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include "BacCloudClient.h"

struct BacOtaPayload {
    char version[32] = {};
    char fwUrl[256] = {};
    char fwSha256[65] = {};
    uint32_t fwSize = 0;
    char assetsUrl[256] = {};
    char assetsSha256[65] = {};
    uint32_t assetsSize = 0;
    char assetsManifestUrl[256] = {};

    bool hasFirmware() const { return fwUrl[0] != 0 && fwSha256[0] != 0 && fwSize > 0; }
    bool hasAssets() const { return assetsUrl[0] != 0 && assetsSha256[0] != 0 && assetsSize > 0; }
    bool valid() const { return version[0] != 0 && (hasFirmware() || hasAssets()); }

    static void copyField(char *dst, size_t dstLen, const String &src) {
        if (!dst || dstLen == 0) return;
        strncpy(dst, src.c_str(), dstLen - 1);
        dst[dstLen - 1] = 0;
    }

    static void parseSemver(const char *v, uint32_t &major, uint32_t &minor, uint32_t &patch) {
        major = minor = patch = 0;
        if (!v) return;
        uint32_t *slots[3] = {&major, &minor, &patch};
        int slot = 0;
        const char *p = v;
        while (*p && slot < 3) {
            if (*p >= '0' && *p <= '9') {
                *slots[slot] = *slots[slot] * 10 + (uint32_t)(*p - '0');
                p++;
            } else if (*p == '.') {
                slot++;
                p++;
            } else {
                break;
            }
        }
    }

    static int compareSemver(const char *a, const char *b) {
        uint32_t am, an, ap, bm, bn, bp;
        parseSemver(a, am, an, ap);
        parseSemver(b, bm, bn, bp);
        if (am != bm) return am < bm ? -1 : 1;
        if (an != bn) return an < bn ? -1 : 1;
        if (ap != bp) return ap < bp ? -1 : 1;
        return 0;
    }

    static bool parseFromJson(const String &json, BacOtaPayload &out) {
        memset(&out, 0, sizeof(out));
        String version = BacCloudClient::extractJsonString(json, "version");
        String fwUrl = BacCloudClient::extractJsonString(json, "url");
        String fwSha = BacCloudClient::extractJsonString(json, "sha256");
        String assetsUrl = BacCloudClient::extractJsonString(json, "assets_url");
        String assetsSha = BacCloudClient::extractJsonString(json, "assets_sha256");
        String assetsManifestUrl = BacCloudClient::extractJsonString(json, "assets_manifest_url");
        if (!version.length()) return false;
        copyField(out.version, sizeof(out.version), version);
        copyField(out.fwUrl, sizeof(out.fwUrl), fwUrl);
        copyField(out.fwSha256, sizeof(out.fwSha256), fwSha);
        out.fwSize = BacCloudClient::extractJsonUInt(json, "size");
        copyField(out.assetsUrl, sizeof(out.assetsUrl), assetsUrl);
        copyField(out.assetsSha256, sizeof(out.assetsSha256), assetsSha);
        out.assetsSize = BacCloudClient::extractJsonUInt(json, "assets_size");
        copyField(out.assetsManifestUrl, sizeof(out.assetsManifestUrl), assetsManifestUrl);
        return out.valid();
    }
};

#else

struct BacOtaPayload {
    bool hasFirmware() const { return false; }
    bool hasAssets() const { return false; }
    bool valid() const { return false; }
    static bool parseFromJson(const String &, BacOtaPayload &) { return false; }
};

#endif
