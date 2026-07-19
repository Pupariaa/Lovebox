#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <Preferences.h>
#include <Lucarne.h>
#include "BacDebug.h"

struct BacUserConfig {
    static constexpr const char *kNvsNs = "bac";
    static constexpr const char *kNvsInitKey = "nvs_init";

    String deviceName;
    String factoryDeviceName;
    String displayName;
    String serialNumber;
    String ssid;
    String psw;
    String oldBootStatus;
    String uuid;
    String apiUrl;
    String apiUrlB1;
    String apiUrlB2;
    String apiSecret;
    String region;
    String locale;
    String buildYear;
    String buildSemester;
    String hwRevision;
    uint8_t backlightLevel = 100;
    uint16_t sleepTimeoutSec = 30;
    bool displaySleepEnabled = true;
    bool configured = false;
    bool claimed = false;
    int32_t tzOffsetSec = 0;
    bool tzOffsetValid = false;

    bool wifiConfigured() const { return ssid.length() > 0; }
    bool deviceConfigured() const { return configured; }

    bool setupComplete() const {
        return configured && wifiConfigured() && apiSecret.length() > 0 && claimed;
    }

    String labelName() const {
        if (displayName.length()) return displayName;
        if (deviceName.length()) return deviceName;
        return "BoiteACoeur";
    }

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
        resetFields();
        Preferences prefs;
        if (!prefs.begin(kNvsNs, true)) return false;
        bool hasNvs = prefs.getBool(kNvsInitKey, false);
        if (hasNvs) {
            loadFromPrefs(prefs);
            prefs.end();
            applyDefaults();
            return true;
        }
        prefs.end();
        if (migrateFromUserTxt()) {
            save();
            return true;
        }
        applyDefaults();
        return false;
    }

    bool save() const {
        Preferences prefs;
        if (!prefs.begin(kNvsNs, false)) return false;
        prefs.putBool(kNvsInitKey, true);
        prefs.putString("device_name", deviceName);
        prefs.putString("factory_device_name", factoryDeviceName.length() ? factoryDeviceName : deviceName);
        prefs.putString("display_name", displayName.length() ? displayName : deviceName);
        prefs.putString("serial_number", serialNumber);
        prefs.putString("ssid", ssid);
        prefs.putString("psw", psw);
        prefs.putString("old_boot_status", oldBootStatus);
        prefs.putString("uuid", uuid);
        prefs.putString("api_url", apiUrl);
        prefs.putString("api_url_b1", apiUrlB1);
        prefs.putString("api_url_b2", apiUrlB2);
        prefs.putString("api_secret", apiSecret);
        prefs.putString("region", region);
        prefs.putString("locale", locale.length() ? locale : "fr");
        prefs.putString("build_year", buildYear);
        prefs.putString("build_semester", buildSemester);
        prefs.putString("hw_revision", hwRevision);
        prefs.putUChar("bl_level", backlightLevel);
        prefs.putUShort("sleep_timeout", sleepTimeoutSec);
        prefs.putBool("disp_sleep", displaySleepEnabled);
        prefs.putBool("configured", configured);
        prefs.putBool("claimed", claimed);
        if (tzOffsetValid) prefs.putInt("tz_offset", tzOffsetSec);
        else prefs.remove("tz_offset");
        prefs.end();
        return true;
    }

private:
    void resetFields() {
        deviceName = "";
        factoryDeviceName = "";
        displayName = "";
        serialNumber = "";
        ssid = "";
        psw = "";
        oldBootStatus = "";
        uuid = "";
        apiUrl = "";
        apiUrlB1 = "";
        apiUrlB2 = "";
        apiSecret = "";
        region = "";
        locale = "fr";
        buildYear = "";
        buildSemester = "";
        hwRevision = "";
        backlightLevel = 100;
        sleepTimeoutSec = 30;
        displaySleepEnabled = true;
        configured = false;
        claimed = false;
        tzOffsetSec = 0;
        tzOffsetValid = false;
    }

    void applyDefaults() {
        if (deviceName.length() == 0) deviceName = "BoiteACoeur";
        if (factoryDeviceName.length() == 0) factoryDeviceName = deviceName;
        if (displayName.length() == 0) displayName = deviceName;
        if (locale.length() == 0) locale = "fr";
        if (!configured && ssid.length() > 0) configured = true;
    }

    void loadFromPrefs(Preferences &prefs) {
        deviceName = prefs.getString("device_name", "");
        factoryDeviceName = prefs.getString("factory_device_name", "");
        displayName = prefs.getString("display_name", "");
        serialNumber = prefs.getString("serial_number", "");
        ssid = prefs.getString("ssid", "");
        psw = prefs.getString("psw", "");
        oldBootStatus = prefs.getString("old_boot_status", "");
        uuid = prefs.getString("uuid", "");
        apiUrl = prefs.getString("api_url", "");
        apiUrlB1 = prefs.getString("api_url_b1", "");
        apiUrlB2 = prefs.getString("api_url_b2", "");
        apiSecret = prefs.getString("api_secret", "");
        region = prefs.getString("region", "");
        locale = prefs.getString("locale", "fr");
        buildYear = prefs.getString("build_year", "");
        buildSemester = prefs.getString("build_semester", "");
        hwRevision = prefs.getString("hw_revision", "");
        backlightLevel = prefs.getUChar("bl_level", 100);
        sleepTimeoutSec = prefs.getUShort("sleep_timeout", 30);
        displaySleepEnabled = prefs.getBool("disp_sleep", true);
        configured = prefs.getBool("configured", false);
        claimed = prefs.getBool("claimed", false);
        if (prefs.isKey("tz_offset")) {
            tzOffsetSec = prefs.getInt("tz_offset", 0);
            tzOffsetValid = true;
        }
    }

    bool migrateFromUserTxt() {
        if (!lucarne::volumeMounted() || !lucarne::volumeFs()) return false;
        File f = lucarne::volumeFs()->open("/user.txt", FILE_READ);
        if (!f) return false;
        bool hasConfiguredKey = false;
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
            else if (key == "factory_device_name") factoryDeviceName = val;
            else if (key == "display_name") displayName = val;
            else if (key == "serial_number") serialNumber = val;
            else if (key == "ssid") ssid = val;
            else if (key == "psw") psw = val;
            else if (key == "old_boot_status") oldBootStatus = val;
            else if (key == "uuid") uuid = val;
            else if (key == "api_url") apiUrl = val;
            else if (key == "api_url_b1") apiUrlB1 = val;
            else if (key == "api_url_b2") apiUrlB2 = val;
            else if (key == "api_secret") apiSecret = val;
            else if (key == "region") region = val;
            else if (key == "locale") locale = val.length() ? val : "fr";
            else if (key == "build_year") buildYear = val;
            else if (key == "build_semester") buildSemester = val;
            else if (key == "hw_revision") hwRevision = val;
            else if (key == "configured") {
                configured = val.toInt() != 0;
                hasConfiguredKey = true;
            } else if (key == "tz_offset") {
                tzOffsetSec = val.toInt();
                tzOffsetValid = true;
            }
        }
        f.close();
        if (serialNumber.length() == 0 || uuid.length() == 0) return false;
        if (!hasConfiguredKey) configured = ssid.length() > 0;
        applyDefaults();
        BacDebug::event("config", "migrated user.txt to nvs");
        if (lucarne::volumeFs()->remove("/user.txt")) {
            BacDebug::event("config", "removed user.txt");
        }
        return true;
    }
};

#else

struct BacUserConfig {
    String deviceName;
    String factoryDeviceName;
    String displayName;
    String serialNumber;
    String ssid;
    String psw;
    String oldBootStatus;
    String uuid;
    String apiUrl;
    String apiSecret;
    String region;
    String locale;
    String buildYear;
    String buildSemester;
    String hwRevision;
    bool configured = false;
    bool claimed = false;
    int32_t tzOffsetSec = 0;
    bool tzOffsetValid = false;
    bool wifiConfigured() const { return false; }
    bool deviceConfigured() const { return false; }
    bool setupComplete() const { return false; }
    String labelName() const { return "BoiteACoeur"; }
    void regenerateUuid() {}
    bool hasValidUuid() const { return false; }
    void ensureValidUuid() {}
    bool load() { return false; }
    bool save() const { return false; }
};

#endif
