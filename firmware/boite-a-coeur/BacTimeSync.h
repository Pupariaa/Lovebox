#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

class BacTimeSync {
public:
    bool fetchOffsetFromIp(int32_t &offsetSec) {
        offsetSec = 0;
        if (WiFi.status() != WL_CONNECTED) return false;
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin("http://ip-api.com/json/?fields=status,offset,timezone")) return false;
        int code = http.GET();
        if (code != 200) {
            http.end();
            return false;
        }
        String body = http.getString();
        http.end();
        if (body.indexOf("\"success\"") < 0) return false;
        int idx = body.indexOf("\"offset\":");
        if (idx < 0) return false;
        offsetSec = body.substring(idx + 9).toInt();
        return true;
    }

    void applyOffset(int32_t offsetSec) {
        _offsetSec = offsetSec;
        configTime(offsetSec, 0, "pool.ntp.org", "time.nist.gov");
    }

    bool waitForSync(uint32_t timeoutMs = 10000) {
        struct tm ti;
        uint32_t start = millis();
        while (millis() - start < timeoutMs) {
            if (getLocalTime(&ti, 200)) return true;
            delay(20);
            yield();
        }
        return false;
    }

    int32_t offsetSec() const { return _offsetSec; }

    bool testInternetReachable() {
        if (WiFi.status() != WL_CONNECTED) return false;
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin("http://clients3.google.com/generate_204")) return false;
        int code = http.GET();
        http.end();
        return code == 204;
    }

private:
    int32_t _offsetSec = 0;
};

#else

class BacTimeSync {
public:
    bool fetchOffsetFromIp(int32_t &) { return false; }
    void applyOffset(int32_t) {}
    bool waitForSync(uint32_t = 10000) { return false; }
    int32_t offsetSec() const { return 0; }
    bool testInternetReachable() { return false; }
};

#endif
