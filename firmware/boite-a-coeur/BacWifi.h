#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <esp_coexist.h>
#include <esp_wifi.h>

class BacWifi {
public:
    static const uint32_t LINK_LOST_GRACE_MS = 15000;

    typedef void (*LinkLostFn)(void *ctx);

    void begin(LinkLostFn fn, void *ctx) {
        if (_eventsReady) return;
        _linkLostFn = fn;
        _linkLostCtx = ctx;
        _instance = this;
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.onEvent(&BacWifi::eventThunk);
        applyCountry();
        _eventsReady = true;
    }

    void startConnect(const char *ssid, const char *pass, bool bleContention = false) {
        _stationUp = false;
        _gotIp = false;
        _linkLostAt = 0;
        _lastDisconnectReason = 0;
        _bleContention = bleContention;
        esp_coex_preference_set(ESP_COEX_PREFER_WIFI);
        WiFi.setSleep(false);
        esp_wifi_set_ps(WIFI_PS_NONE);
        esp_wifi_set_max_tx_power(78);
        applyCountry();
        WiFi.mode(WIFI_OFF);
        vTaskDelay(pdMS_TO_TICKS(150));
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.disconnect(false, false);
        vTaskDelay(pdMS_TO_TICKS(150));
        int channel = 0;
        if (!bleContention) channel = findChannelForSsid(ssid);
        if (channel > 0) WiFi.begin(ssid, pass, channel);
        else WiFi.begin(ssid, pass);
        _connectStartedMs = millis();
    }

    void finishConnectAttempt() {
        esp_coex_preference_set(ESP_COEX_PREFER_BALANCE);
        _bleContention = false;
    }

    bool connected() const {
        return _gotIp && WiFi.status() == WL_CONNECTED && WiFi.localIP()[0] != 0;
    }

    uint32_t connectElapsedMs() const { return millis() - _connectStartedMs; }

    uint8_t lastDisconnectReason() const { return _lastDisconnectReason; }

    bool bleContention() const { return _bleContention; }

    void markStationUp() {
        _stationUp = true;
        _linkLostAt = 0;
    }

    void markStationDown() {
        _stationUp = false;
        _linkLostAt = 0;
    }

    void pollLink(uint32_t now, bool monitor) {
        if (!monitor) {
            _linkLostAt = 0;
            return;
        }
        if (connected()) {
            _stationUp = true;
            _linkLostAt = 0;
            return;
        }
        if (!_stationUp) return;
        if (_linkLostAt == 0) _linkLostAt = now;
        if (now - _linkLostAt < LINK_LOST_GRACE_MS) return;
        _stationUp = false;
        _linkLostAt = 0;
        if (_linkLostFn) _linkLostFn(_linkLostCtx);
    }

    static void eventThunk(WiFiEvent_t event, WiFiEventInfo_t info) {
        if (_instance) _instance->onEvent(event, info);
    }

private:
    void applyCountry() {
        wifi_country_t country = {};
        strncpy((char *)country.cc, "01", 2);
        country.schan = 1;
        country.nchan = 13;
        country.policy = WIFI_COUNTRY_POLICY_AUTO;
        esp_wifi_set_country(&country);
    }

    int findChannelForSsid(const char *ssid) {
        if (!ssid || !ssid[0]) return 0;
        int n = WiFi.scanNetworks(false, false, false, 400);
        for (int i = 0; i < n; i++) {
            if (WiFi.SSID(i) == ssid) return WiFi.channel(i);
        }
        return 0;
    }

    void onEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
        if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
            _gotIp = true;
            _stationUp = true;
            _linkLostAt = 0;
        } else if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
            _gotIp = false;
            _lastDisconnectReason = info.wifi_sta_disconnected.reason;
            if (_stationUp && _linkLostAt == 0) _linkLostAt = millis();
        }
    }

    static BacWifi *_instance;

    LinkLostFn _linkLostFn = nullptr;
    void *_linkLostCtx = nullptr;
    bool _eventsReady = false;
    bool _stationUp = false;
    bool _gotIp = false;
    bool _bleContention = false;
    uint8_t _lastDisconnectReason = 0;
    uint32_t _linkLostAt = 0;
    uint32_t _connectStartedMs = 0;
};

BacWifi *BacWifi::_instance = nullptr;

#else

class BacWifi {
public:
    typedef void (*LinkLostFn)(void *);
    void begin(LinkLostFn, void *) {}
    void startConnect(const char *, const char *, bool = false) {}
    void finishConnectAttempt() {}
    bool connected() const { return false; }
    uint32_t connectElapsedMs() const { return 0; }
    uint8_t lastDisconnectReason() const { return 0; }
    bool bleContention() const { return false; }
    void markStationUp() {}
    void markStationDown() {}
    void pollLink(uint32_t, bool) {}
};

#endif
