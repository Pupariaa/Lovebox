#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <Lucarne.h>

struct BacUserConfig {
    String deviceName;
    String serialNumber;
    String ssid;
    String psw;
    String oldBootStatus;
    String uuid;
    String apiUrl;
    String apiSecret;
    String region;
    bool configured = false;
    int32_t tzOffsetSec = 0;
    bool tzOffsetValid = false;

    bool wifiConfigured() const { return ssid.length() > 0; }
    bool deviceConfigured() const { return configured; }

    void regenerateUuid() {
        uuid = "";
        uuid.reserve(128);
        for (int i = 0; i < 128; i++) uuid += char('0' + random(10));
    }

    bool hasValidUuid() const {
        if (uuid.length() != 128) return false;
        for (unsigned i = 0; i < uuid.length(); i++) {
            if (uuid[i] < '0' || uuid[i] > '9') return false;
        }
        return true;
    }

    void ensureValidUuid() {
        if (hasValidUuid()) return;
        regenerateUuid();
    }

    bool load() {
        deviceName = "";
        serialNumber = "";
        ssid = "";
        psw = "";
        oldBootStatus = "";
        uuid = "";
        apiUrl = "";
        apiSecret = "";
        region = "";
        configured = false;
        tzOffsetSec = 0;
        tzOffsetValid = false;
        bool hasConfiguredKey = false;
        if (!lucarne::volumeMounted() || !lucarne::volumeFs()) return false;
        File f = lucarne::volumeFs()->open("/user.txt", FILE_READ);
        if (!f) return false;
        while (f.available()) {
            String line = f.readStringUntil('\n');
            line.trim();
            if (line.length() == 0) continue;
            int sep = line.indexOf(':');
            if (sep < 0) continue;
            String key = line.substring(0, sep);
            String val = line.substring(sep + 1);
            key.trim();
            val.trim();
            if (key == "device_name") deviceName = val;
            else if (key == "serial_number") serialNumber = val;
            else if (key == "ssid") ssid = val;
            else if (key == "psw") psw = val;
            else if (key == "old_boot_status") oldBootStatus = val;
            else if (key == "uuid") uuid = val;
            else if (key == "api_url") apiUrl = val;
            else if (key == "api_secret") apiSecret = val;
            else if (key == "region") region = val;
            else if (key == "configured") {
                configured = val.toInt() != 0;
                hasConfiguredKey = true;
            } else if (key == "tz_offset") {
                tzOffsetSec = val.toInt();
                tzOffsetValid = true;
            }
        }
        f.close();
        if (deviceName.length() == 0) deviceName = "BoiteACoeur";
        if (!hasConfiguredKey) configured = ssid.length() > 0;
        return true;
    }

    bool save() const {
        if (!lucarne::volumeMounted() || !lucarne::volumeFs()) return false;
        File f = lucarne::volumeFs()->open("/user.txt", FILE_WRITE);
        if (!f) return false;
        f.print("device_name: ");
        f.println(deviceName);
        f.print("serial_number: ");
        f.println(serialNumber);
        f.print("ssid: ");
        f.println(ssid);
        f.print("psw: ");
        f.println(psw);
        f.print("configured: ");
        f.println(configured ? 1 : 0);
        f.print("uuid: ");
        f.println(uuid);
        if (apiUrl.length()) {
            f.print("api_url: ");
            f.println(apiUrl);
        }
        if (apiSecret.length()) {
            f.print("api_secret: ");
            f.println(apiSecret);
        }
        if (region.length()) {
            f.print("region: ");
            f.println(region);
        }
        f.print("old_boot_status: ");
        f.println(oldBootStatus);
        if (tzOffsetValid) {
            f.print("tz_offset: ");
            f.println(tzOffsetSec);
        }
        f.close();
        return true;
    }
};

#else

struct BacUserConfig {
    String deviceName;
    String serialNumber;
    String ssid;
    String psw;
    String oldBootStatus;
    String uuid;
    String apiUrl;
    String apiSecret;
    String region;
    bool configured = false;
    int32_t tzOffsetSec = 0;
    bool tzOffsetValid = false;
    bool wifiConfigured() const { return false; }
    bool deviceConfigured() const { return false; }
    void regenerateUuid() {}
    bool hasValidUuid() const { return false; }
    void ensureValidUuid() {}
    bool load() { return false; }
    bool save() const { return false; }
};

#endif
