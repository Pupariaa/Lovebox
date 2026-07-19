#pragma once

#if defined(ESP32)

#include <Arduino.h>

struct BacUrlFailover {
    static constexpr size_t kHostCount = 3;

    static size_t hostCount() { return kHostCount; }

    static const char *defaultHost(size_t index) {
        static const char *kHosts[kHostCount] = {
            "https://boite-a-coeur.fr",
            "https://update.bac-tcy.com",
            "https://update.tcy-services.com",
        };
        if (index >= kHostCount) return kHosts[0];
        return kHosts[index];
    }

    static String rewriteBase(const char *url, const char *base) {
        if (!url || !url[0] || !base || !base[0]) return String(url ? url : "");
        String src(url);
        int scheme = src.indexOf("://");
        if (scheme < 0) return src;
        int path = src.indexOf('/', scheme + 3);
        String suffix = path >= 0 ? src.substring(path) : String("");
        String out(base);
        if (suffix.length()) out += suffix;
        return out;
    }

    static bool httpOk(int code) { return code >= 200 && code <= 299; }
};

#else

struct BacUrlFailover {
    static size_t hostCount() { return 0; }
    static const char *defaultHost(size_t) { return ""; }
    static String rewriteBase(const char *, const char *) { return String(); }
    static bool httpOk(int code) { return code >= 200 && code <= 299; }
};

#endif
