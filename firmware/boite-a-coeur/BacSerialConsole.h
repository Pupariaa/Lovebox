#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include "BacApp.h"
#include "BacDebug.h"

class BacSerialConsole {
public:
    void begin() {
        _line = "";
        BacDebug::reply("");
        BacDebug::reply("BoiteACoeur firmware 1.0.0");
        BacDebug::reply("Serial console ready. Type 'help'.");
        BacDebug::reply("");
    }

    void poll(BacApp &app) {
        while (Serial.available() > 0) {
            char c = (char)Serial.read();
            if (c == '\r') continue;
            if (c == '\n') {
                String line = _line;
                _line = "";
                line.trim();
                if (line.length() > 0) handleLine(app, line);
                continue;
            }
            if (_line.length() < 127) _line += c;
        }
    }

private:
    String _line;

    void handleLine(BacApp &app, const String &line) {
        String cmd = line;
        cmd.toLowerCase();
        if (cmd == "help" || cmd == "?") {
            printHelp();
        } else if (cmd.startsWith("wifi join ")) {
            String rest = line.substring(10);
            rest.trim();
            int sp = rest.indexOf(' ');
            if (sp < 0) {
                BacDebug::reply("usage: wifi join SSID PASSWORD");
                return;
            }
            String ssid = rest.substring(0, sp);
            String pass = rest.substring(sp + 1);
            ssid.trim();
            pass.trim();
            app.testWifiJoin(ssid.c_str(), pass.c_str());
            BacDebug::reply("wifi join started");
        } else if (cmd == "info") {
            printInfo(app);
        } else if (cmd == "wifi") {
            printWifi(app);
        } else if (cmd == "ble") {
            printBle(app);
        } else if (cmd == "mode") {
            printMode(app);
        } else if (cmd == "uuid") {
            printUuid(app);
        } else if (cmd == "stats") {
            printStats();
        } else if (cmd == "debug on") {
            BacDebug::verbose = true;
            BacDebug::reply("debug verbose on");
        } else if (cmd == "debug off") {
            BacDebug::verbose = false;
            BacDebug::reply("debug verbose off");
        } else if (cmd == "debug") {
            BacDebug::reply(BacDebug::verbose ? "debug: on" : "debug: off");
        } else if (cmd == "reload") {
            app.reloadUserConfig();
            BacDebug::reply("config reloaded");
        } else if (cmd == "reboot") {
            BacDebug::reply("rebooting...");
            delay(100);
            app.rebootNow();
        } else if (cmd == "reset") {
            BacDebug::reply("factory reset...");
            app.factoryResetNow();
        } else {
            BacDebug::reply("unknown command (help)");
        }
    }

    static void printHelp() {
        BacDebug::reply("help info wifi ble mode uuid stats");
        BacDebug::reply("wifi join SSID PASSWORD");
        BacDebug::reply("debug [on|off] reload reboot reset");
    }

    static void printField(const char *key, const String &val) {
        Serial.print(key);
        Serial.print(F(": "));
        Serial.println(val.length() ? val.c_str() : "-");
    }

    static void printSecretField(const char *key, const String &val) {
        Serial.print(key);
        Serial.print(F(": "));
        if (val.length() == 0) {
            Serial.println(F("-"));
            return;
        }
        Serial.print(F("[set, "));
        Serial.print(val.length());
        Serial.println(F(" chars]"));
    }

    static void printInfo(BacApp &app) {
        const BacUserConfig &c = app.userConfig();
        printField("device_name", c.deviceName);
        printField("serial_number", c.serialNumber);
        printField("uuid", c.uuid);
        printField("ssid", c.ssid);
        printSecretField("psw", c.psw);
        Serial.print(F("configured: "));
        Serial.println(c.configured ? F("yes") : F("no"));
        printField("api_url", c.apiUrl.length() ? c.apiUrl : String("https://boite-a-coeur.techalchemy.fr"));
        printSecretField("api_secret", c.apiSecret);
        printField("region", c.region);
        if (c.tzOffsetValid) {
            Serial.print(F("tz_offset: "));
            Serial.println(c.tzOffsetSec);
        }
        printMode(app);
        printWifi(app);
        printBle(app);
    }

    static void printUuid(BacApp &app) {
        printField("uuid", app.userConfig().uuid);
    }

    static void printWifi(BacApp &app) {
        const BacUserConfig &c = app.userConfig();
        printField("ssid", c.ssid);
        Serial.print(F("wifi_status: "));
        Serial.println(wifiStatusText(WiFi.status()));
        Serial.print(F("connected: "));
        Serial.println(app.isWifiLinked() ? F("yes") : F("no"));
        if (app.isWifiLinked()) {
            Serial.print(F("ip: "));
            Serial.println(WiFi.localIP());
            Serial.print(F("rssi: "));
            Serial.println(WiFi.RSSI());
        }
        Serial.print(F("wifi_attempt: "));
        Serial.println(app.isWifiAttemptActive() ? F("yes") : F("no"));
        if (app.isWifiAttemptActive()) {
            Serial.print(F("wifi_attempt_ms: "));
            Serial.println(app.wifiConnectElapsedMs());
        }
        uint8_t reason = app.lastWifiDisconnectReason();
        if (reason) {
            Serial.print(F("wifi_disc_reason: "));
            Serial.print(reason);
            Serial.print(F(" ("));
            Serial.print(wifiReasonText(reason));
            Serial.println(F(")"));
        }
    }

    static void printBle(BacApp &app) {
        Serial.print(F("ble_ready: "));
        Serial.println(app.isBleReady() ? F("yes") : F("no"));
        Serial.print(F("ble_provisioning: "));
        Serial.println(app.isBleProvisioning() ? F("yes") : F("no"));
        Serial.print(F("ble_app_connected: "));
        Serial.println(app.isBleAppConnected() ? F("yes") : F("no"));
        Serial.print(F("ble_prov_status: "));
        Serial.println(bleStatusText(app.bleProvisionStatus()));
    }

    static void printMode(BacApp &app) {
        Serial.print(F("mode: "));
        Serial.println(app.modeName());
        Serial.print(F("screen: "));
        Serial.println(app.screenName());
        Serial.print(F("first_setup_step: "));
        Serial.println(app.firstSetupStep());
        Serial.print(F("touch_enabled: "));
        Serial.println(app.touchEnabled() ? F("yes") : F("no"));
        Serial.print(F("http_server: "));
        Serial.println(app.isHttpServerStarted() ? F("yes") : F("no"));
        Serial.print(F("cloud_registered: "));
        Serial.println(app.hasCloudSecret() ? F("yes") : F("no"));
    }

    static void printStats() {
        Serial.print(F("uptime_ms: "));
        Serial.println(millis());
        Serial.print(F("heap_free: "));
        Serial.println(ESP.getFreeHeap());
        Serial.print(F("heap_min: "));
        Serial.println(ESP.getMinFreeHeap());
        Serial.print(F("psram_free: "));
        Serial.println(heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
        Serial.print(F("int_free: "));
        Serial.println(heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
    }

    static const char *wifiReasonText(uint8_t reason) {
        switch (reason) {
            case 2: return "auth_expire";
            case 15: return "4way_handshake_timeout";
            case 200: return "beacon_timeout";
            case 201: return "no_ap_found";
            case 202: return "auth_fail";
            case 203: return "assoc_fail";
            case 204: return "handshake_timeout";
            default: return "other";
        }
    }

    static const char *wifiStatusText(wl_status_t st) {
        switch (st) {
            case WL_CONNECTED: return "connected";
            case WL_NO_SSID_AVAIL: return "no_ssid";
            case WL_CONNECT_FAILED: return "connect_failed";
            case WL_CONNECTION_LOST: return "connection_lost";
            case WL_DISCONNECTED: return "disconnected";
            case WL_IDLE_STATUS: return "idle";
            default: return "unknown";
        }
    }

    static const char *bleStatusText(uint8_t code) {
        switch (code) {
            case 0: return "idle";
            case 1: return "connecting";
            case 2: return "ok";
            case 3: return "fail";
            default: return "unknown";
        }
    }
};

#else

class BacApp;

class BacSerialConsole {
public:
    void begin() {}
    void poll(BacApp &) {}
};

#endif
