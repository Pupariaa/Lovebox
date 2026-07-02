#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <stdarg.h>

class BacDebug {
public:
    static bool verbose;

    static void boot(const char *msg) {
        Serial.print(F("boot: "));
        Serial.println(msg);
    }

    static void reply(const char *msg) {
        Serial.println(msg);
    }

    static void log(const char *tag, const char *msg) {
        if (!verbose) return;
        Serial.print('[');
        Serial.print(tag);
        Serial.print(F("] "));
        Serial.println(msg);
    }

    static void logf(const char *tag, const char *fmt, ...) {
        if (!verbose) return;
        char buf[192];
        va_list ap;
        va_start(ap, fmt);
        vsnprintf(buf, sizeof(buf), fmt, ap);
        va_end(ap);
        log(tag, buf);
    }
};

inline bool BacDebug::verbose = false;

#define BAC_LOG(tag, msg) BacDebug::log(tag, msg)
#define BAC_LOGF(tag, fmt, ...) BacDebug::logf(tag, fmt, ##__VA_ARGS__)
#define BAC_BOOT(msg) BacDebug::boot(msg)

#else

#define BAC_LOG(tag, msg) ((void)0)
#define BAC_LOGF(tag, fmt, ...) ((void)0)
#define BAC_BOOT(msg) ((void)0)

#endif
