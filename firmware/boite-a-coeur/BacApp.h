#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <time.h>
#include <string.h>
#include <esp_random.h>
#include <ESP.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "Projet.h"
#include "BacUserConfig.h"
#include "BacBle.h"
#include "BacWifi.h"
#include "BacScreenCache.h"
#include "BacTimeSync.h"
#include "BacMessageStore.h"
#include "BacMessageServer.h"
#include "BacMessageRenderer.h"
#include "BacScreens.h"
#include "BacCloudClient.h"
#include "BacDebug.h"
#include "BacLocale.h"
#include "BacFirmware.h"
#include "BacOta.h"
#include "BacAssetsOta.h"
#include "BacOtaPayload.h"

class BacApp {
public:
    static const uint32_t WIFI_CONNECT_MIN_MS = 8000;
    static const uint32_t WIFI_BOOT_TIMEOUT_MS = 20000;
    static const uint32_t WIFI_CONNECT_BLE_EXTRA_MS = 30000;
    static const uint32_t TOUCH_ARM_P1_MS = 3000;
    static const uint32_t TOUCH_ARM_NAV_MS = 500;
    static const uint32_t TOUCH_PRESS_MIN = 23500;
    static const uint32_t TOUCH_RELEASE_MAX = 22500;
    static const uint32_t TOUCH_VALID_MIN = 15000;
    static const uint32_t TOUCH_VALID_MAX = 32000;
    static const uint32_t P4_AUTO_IDLE_MS = 8000;
    static const uint32_t SETTINGS_OPEN_MS = 5000;
    static const uint32_t TAP_MAX_MS = 500;
    static const uint32_t MENU_SELECT_HOLD_MS = 500;
    static const uint32_t DISCONNECT_MIN_MS = 3000;
    static const uint32_t WIFI_TEST_MIN_MS = 5000;
    static const uint32_t FACTORY_RESET_MIN_MS = 10000;
    static const size_t PROV_SSID_MAX = 32;
    static const size_t PROV_PASS_MAX = 63;

    void begin(lucarne::UI &ui, BacScreenCache &cache) {
        _ui = &ui;
        _cache = &cache;
        randomSeed((uint32_t)(esp_random() ^ millis()));
        _config.load();
        BacLocale::prepare(_config.locale.c_str());
        applyUiLocale();
        applyDeviceName();
        _ble.setWifiHandler(&BacApp::wifiProvThunk, this);
        _ble.setConfigHandler(&BacApp::bleConfigThunk, this);
        _wifi.begin(&BacApp::wifiLinkLostThunk, this);
        _mode = Mode::Caching;
        _first = FirstStep::P1;
        _touchEnabled = false;
        _ntpStarted = false;
        _wifiAttemptActive = false;
        _wifiConnectStartedMs = 0;
        _wifiScreenStartedMs = 0;
        _pendingSsid = "";
        _pendingPass = "";
        _lastClockUpdateMs = 0;
        _wasTouchPressed = false;
        _touchArmUntilMs = 0;
        _touchPressStartMs = 0;
        _touchSelectFired = false;
        _touchSettingsFired = false;
        _p4ShownMs = 0;
        _pendingFlow = PendingFlow::None;
        _flowStartedMs = 0;
        _wifiTestDone = false;
        _wifiTestOk = false;
        _lastScreen = nullptr;
        _provPending = false;
        _provSsid[0] = 0;
        _provPass[0] = 0;
        _connectSsid[0] = 0;
        _connectPass[0] = 0;
        _httpStarted = false;
        _msgRenderer.begin(&_msgStore);
        _cloudClient.begin(&_config, &BacApp::cloudMessageThunk, this);
        _cloudClient.setConfigCommandHandler(&BacApp::cloudConfigThunk, this);
        _cloudClient.setOtaOfferHandler(&BacApp::cloudOtaOfferThunk, this);
    }

    void drawMessageOverlay(lucarne::Display &disp) {
        if (!messageViewActive()) return;
        _msgRenderer.draw(disp, millis());
        disp.presentFull();
    }

    bool messageViewActive() const {
        return onCurrentScreen("message_opened") && _msgStore.hasMessage();
    }

    bool hasPendingMessage() const { return _msgStore.hasMessage(); }

    void onCacheReady() {
        if (!_ui) return;
        String prevUuid = _config.uuid;
        _config.ensureValidUuid();
        if (!_config.hasValidUuid()) return;
        if (_config.uuid != prevUuid && _config.serialNumber.length() > 0) {
            _config.apiSecret = "";
            _config.save();
        }
        if (!_config.deviceConfigured()) {
            beginFirstSetup();
            BAC_BOOT("first setup");
            return;
        }
        if (!_config.wifiConfigured()) {
            _mode = Mode::Lost;
            _touchEnabled = true;
            go(&projet::screen_scr_mqwqhtj72);
            openBleProvisioning();
            BAC_BOOT("no wifi");
            return;
        }
        _mode = Mode::WifiBoot;
        startWifiAttempt(_config.ssid.c_str(), _config.psw.c_str(), false);
        BAC_BOOT("wifi boot");
    }

    void tick(uint32_t touchVal) {
        if (!_ui) return;
        if (_cache && _ui->current() && lazyCacheAllowed()) {
            _cache->tickLazy(_ui->current(), _mode == Mode::FirstSetup);
        }
        pollPendingFlow();
        pollPendingWifiProv();
        _ble.poll();
        pollScreenChange();
        pollWifi();
        pollWifiConnectingWatchdog();
        pollWifiLink();
        pollP4();
        pollClock();
        pollMenuActions();
        pollPendingMessage();
        pollOtaPending();
        if (_httpStarted) _msgServer.tick();
        if (_mode == Mode::Idle) _cloudClient.tickIdle();
        if (_touchEnabled) pollTouch(touchVal);
    }

    bool touchEnabled() const { return _touchEnabled; }
    int firstSetupStep() const { return (int)_first; }

    const BacUserConfig& userConfig() const { return _config; }
    bool reloadUserConfig() {
        _config.load();
        BacLocale::prepare(_config.locale.c_str());
        applyUiLocale();
        applyDeviceName();
        updateClockLabels(true);
        return true;
    }
    const char* modeName() const {
        switch (_mode) {
            case Mode::Caching: return "caching";
            case Mode::FirstSetup: return "first_setup";
            case Mode::WifiBoot: return "wifi_boot";
            case Mode::Idle: return "idle";
            case Mode::Lost: return "lost";
            case Mode::Settings: return "settings";
            default: return "unknown";
        }
    }
    const char* screenName() const {
        if (!_ui || !_ui->current() || !_ui->current()->name()) return "-";
        return _ui->current()->name();
    }
    bool isWifiLinked() const { return _wifi.connected(); }
    bool isWifiAttemptActive() const { return _wifiAttemptActive; }
    uint32_t wifiConnectElapsedMs() const { return _wifi.connectElapsedMs(); }
    bool isBleReady() const { return _ble.isReady(); }
    bool isBleProvisioning() const { return _ble.provisioningActive(); }
    bool isBleAppConnected() const { return _ble.isAppConnected(); }
    uint8_t bleProvisionStatus() const { return _ble.provisionStatus(); }
    bool isHttpServerStarted() const { return _httpStarted; }
    bool hasCloudSecret() const { return _config.apiSecret.length() > 0; }
    void rebootNow() {
        delay(100);
        ESP.restart();
    }
    void factoryResetNow() {
        _config.ssid = "";
        _config.psw = "";
        _config.configured = false;
        _config.apiSecret = "";
        _config.regenerateUuid();
        _config.save();
        delay(100);
        ESP.restart();
    }

    void openBleProvisioning() {
        _ble.begin(_config.deviceName.c_str(), _config.serialNumber.c_str());
        _ble.setIdentityUuid(_config.uuid.c_str());
        _ble.openProvisioning();
        BAC_LOG("ble", "provisioning on");
    }

    void closeBleProvisioning(bool powerDown = true) {
        _ble.closeProvisioning(powerDown);
        if (!powerDown) BAC_LOG("ble", "advertising off");
        else BAC_LOG("ble", "off");
    }

    bool bleProvisioningActive() const { return _ble.provisioningActive(); }
    bool wifiConnected() const { return _wifi.connected(); }

    void requestWifiReconnect() {
        if (!_config.wifiConfigured()) return;
        if (_wifiAttemptActive) return;
        _pendingSsid = _config.ssid;
        _pendingPass = _config.psw;
        startWifiAttempt(_config.ssid.c_str(), _config.psw.c_str(), false);
    }

    void testWifiJoin(const char *ssid, const char *pass) {
        if (!ssid || !ssid[0]) return;
        if (_wifiAttemptActive) return;
        _pendingSsid = ssid;
        _pendingPass = pass ? pass : "";
        _wifiFirstSetupMin = false;
        _wifiAttemptActive = true;
        _wifiConnectStartedMs = millis();
        _wifiScreenStartedMs = millis();
        BAC_LOGF("wifi", "manual join ssid=%s", ssid);
        _wifi.startConnect(ssid, pass, false);
    }

    uint8_t lastWifiDisconnectReason() const { return _wifi.lastDisconnectReason(); }

    void forgetWifiAndReprovision() {
        clearWifiCreds();
        _wifiAttemptActive = false;
        _ntpStarted = false;
        enterLost();
        openBleProvisioning();
        BAC_LOG("wifi", "forgotten");
    }

    void onLostConnectionScreen() {
        if (_mode == Mode::Lost) return;
        enterLost();
        openBleProvisioning();
    }

private:
    enum class Mode : uint8_t { Caching, FirstSetup, WifiBoot, Idle, Lost, Settings };
    enum class FirstStep : uint8_t { P1, P2, P3, P4, WifiConnecting, WifiError };
    enum class PendingFlow : uint8_t { None, Disconnect, WifiTest, FactoryReset };

    static void bleConfigThunk(const char *payload, void *ctx) {
        static_cast<BacApp *>(ctx)->onBleConfig(payload);
    }

    static void wifiProvThunk(const char *ssid, const char *pass, void *ctx) {
        static_cast<BacApp *>(ctx)->onWifiProvision(ssid, pass);
    }

    static void wifiLinkLostThunk(void *ctx) {
        static_cast<BacApp *>(ctx)->onWifiLinkLost();
    }

    static void messageReceivedThunk(void *ctx, uint8_t *data, size_t len) {
        static_cast<BacApp *>(ctx)->queueMessage(data, len, 0);
    }

    static void cloudConfigThunk(void *ctx, const char *json) {
        static_cast<BacApp *>(ctx)->onCloudCommand(json);
    }

    static void cloudOtaOfferThunk(void *ctx, const char *json) {
        static_cast<BacApp *>(ctx)->onOtaOffer(json);
    }

    static void otaProgressThunk(void *ctx, int percent) {
        static_cast<BacApp *>(ctx)->onOtaProgress(percent);
    }

    static void otaTaskEntry(void *arg) {
        static_cast<BacApp *>(arg)->otaTaskBody();
    }

    static void cloudMessageThunk(void *ctx, uint8_t *data, size_t len, uint32_t messageId) {
        static_cast<BacApp *>(ctx)->queueMessage(data, len, messageId);
    }

    bool onCurrentScreen(const char *name) const {
        if (!_ui || !name) return false;
        lucarne::Screen *cur = _ui->current();
        return cur && cur->name() && strcmp(cur->name(), name) == 0;
    }

    void queueMessage(uint8_t *data, size_t len, uint32_t cloudMessageId = 0) {
        if (!data || len == 0) return;
        if (_pendingMsgBuf) heap_caps_free(_pendingMsgBuf);
        _pendingMsgBuf = data;
        _pendingMsgLen = len;
        _pendingCloudAckId = cloudMessageId;
        _pendingMsg = true;
    }

    void pollPendingMessage() {
        if (!_pendingMsg || !_pendingMsgBuf) return;
        _pendingMsg = false;
        uint8_t *buf = _pendingMsgBuf;
        size_t len = _pendingMsgLen;
        _pendingMsgBuf = nullptr;
        _pendingMsgLen = 0;
        if (!_msgStore.loadFromBinary(buf, len)) {
            BAC_LOG("msg", "invalid");
            heap_caps_free(buf);
            if (_pendingCloudAckId) {
                _cloudClient.nackMessage(_pendingCloudAckId);
                _pendingCloudAckId = 0;
            }
            return;
        }
        heap_caps_free(buf);
        if (_pendingCloudAckId) {
            _cloudClient.ackMessage(_pendingCloudAckId);
            _pendingCloudAckId = 0;
        }
        onMessageReceived();
    }

    void onMessageReceived() {
        BAC_LOG("msg", "received");
        if (_otaRunning || _otaPending) return;
        if (_mode == Mode::Settings || _mode == Mode::FirstSetup || _mode == Mode::WifiBoot) return;
        goInstant(&projet::screen_scr_mqxp1ppa3);
    }

    void openMessageView() {
        if (!_msgStore.hasMessage()) return;
        _msgRenderer.resetAnim();
        goInstant(&bac::screen_message_opened);
    }

    void startMessageServer() {
        if (_httpStarted) return;
        if (WiFi.status() != WL_CONNECTED) return;
        _msgServer.begin(&_msgStore, &_config, &BacApp::messageReceivedThunk, this);
        _httpStarted = true;
    }

    void stopMessageServer() {
        if (!_httpStarted) return;
        _msgServer.stop();
        _httpStarted = false;
    }

    bool settingsLongPressAllowed() const {
        return _mode == Mode::Idle || _mode == Mode::Lost;
    }

    bool settingsTouchAllowed() const {
        return _mode == Mode::Settings && _pendingFlow == PendingFlow::None;
    }

    void beginFirstSetup() {
        _mode = Mode::FirstSetup;
        _first = FirstStep::P1;
        go(&projet::screen_scr_mqxp1a2f2);
        armTouch(TOUCH_ARM_P1_MS, true);
        _touchEnabled = true;
    }

    void enterSettings() {
        if (_mode == Mode::Settings) return;
        if (!settingsLongPressAllowed()) return;
        _mode = Mode::Settings;
        _wasTouchPressed = false;
        _touchSelectFired = false;
        _touchSettingsFired = false;
        armTouch(TOUCH_ARM_NAV_MS, true);
        go(&projet::screen_scr_mr14c6nfb);
        BAC_LOG("ui", "settings");
    }

    void clearWifiCreds() {
        _config.ssid = "";
        _config.psw = "";
        _config.configured = true;
        _config.save();
        WiFi.disconnect(true, false);
        _wifi.markStationDown();
    }

    void startDisconnectFlow() {
        if (_pendingFlow != PendingFlow::None) return;
        _pendingFlow = PendingFlow::Disconnect;
        _flowStartedMs = millis();
        go(&projet::screen_scr_mr15w6br17);
        BAC_LOG("wifi", "disconnect start");
    }

    void startWifiTestFlow() {
        if (_pendingFlow != PendingFlow::None) return;
        _pendingFlow = PendingFlow::WifiTest;
        _flowStartedMs = millis();
        _wifiTestDone = false;
        _wifiTestOk = false;
        BAC_LOG("wifi", "test start");
    }

    void startFactoryResetFlow() {
        if (_pendingFlow != PendingFlow::None) return;
        _pendingFlow = PendingFlow::FactoryReset;
        _flowStartedMs = millis();
        BAC_LOG("sys", "factory reset start");
    }

    void pollScreenChange() {
        if (!_ui) return;
        lucarne::Screen *cur = _ui->current();
        if (cur == _lastScreen) return;
        _lastScreen = cur;
        onScreenEnter(cur);
    }

    void pollPendingFlow() {
        if (_pendingFlow == PendingFlow::None) return;
        uint32_t elapsed = millis() - _flowStartedMs;

        if (_pendingFlow == PendingFlow::Disconnect) {
            if (elapsed < DISCONNECT_MIN_MS) return;
            clearWifiCreds();
            _wifiAttemptActive = false;
            _ntpStarted = false;
            closeBleProvisioning(false);
            _mode = Mode::Settings;
            go(&projet::screen_scr_mr163td21f);
            _pendingFlow = PendingFlow::None;
            BAC_LOG("wifi", "disconnected");
            return;
        }

        if (_pendingFlow == PendingFlow::WifiTest) {
            if (!_wifiTestDone && elapsed >= 500) {
                _wifiTestOk = _timeSync.testInternetReachable();
                _wifiTestDone = true;
            }
            if (elapsed < WIFI_TEST_MIN_MS) return;
            _pendingFlow = PendingFlow::None;
            if (_wifiTestOk) go(&projet::screen_scr_mr16b8yk1t);
            else go(&projet::screen_scr_mr16dm621x);
            BAC_LOG("wifi", _wifiTestOk ? "test ok" : "test fail");
            return;
        }

        if (_pendingFlow == PendingFlow::FactoryReset) {
            if (elapsed < FACTORY_RESET_MIN_MS) return;
            performFactoryReset();
        }
    }

    void performFactoryReset() {
        _config.ssid = "";
        _config.psw = "";
        _config.configured = false;
        _config.claimed = false;
        _config.apiSecret = "";
        _config.save();
        _pendingFlow = PendingFlow::None;
        BAC_LOG("sys", "factory reset restart");
        delay(100);
        ESP.restart();
    }

    void onCloudCommand(const char *json) {
        if (!json) return;
        String body = json;
        String type = BacCloudClient::extractJsonString(body, "command_type");
        if (type == "ota") {
            if (!canRunOta()) {
                BacDebug::event("ota", "blocked during setup");
                return;
            }
            uint32_t cmdId = BacCloudClient::extractJsonUInt(body, "command_id");
            String payload = BacCloudClient::extractJsonObject(body, "payload");
            if (!payload.length()) payload = body;
            queueOtaFromPayload(payload, cmdId);
            return;
        }
        if (type.length() && type != "config") return;
        int idx = body.indexOf("\"display_name\":\"");
        if (idx >= 0) {
            idx += 16;
            int end = body.indexOf('"', idx);
            if (end > idx) {
                _config.displayName = body.substring(idx, end);
                applyDeviceName();
                _config.save();
            }
        }
        idx = body.indexOf("\"region\":\"");
        if (idx >= 0) {
            idx += 10;
            int end = body.indexOf('"', idx);
            if (end > idx) {
                _config.region = body.substring(idx, end);
                _config.save();
            }
        }
    }

    void onOtaOffer(const char *json) {
        if (!json || _otaRunning || !canRunOta()) return;
        queueOtaFromPayload(String(json), 0);
    }

    bool canRunOta() const {
        return _config.setupComplete() && _mode == Mode::Idle;
    }

    void queueOtaFromPayload(const String &payload, uint32_t commandId) {
        if (_otaRunning || _otaPending) return;
        if (!_config.claimed) {
            BacDebug::event("ota", "blocked not claimed");
            return;
        }
        if (_otaShaBackoffUntilMs != 0 && millis() < _otaShaBackoffUntilMs) {
            BacDebug::event("ota", "sha backoff active");
            return;
        }
        String root = payload;
        String inner = BacCloudClient::extractJsonObject(payload, "payload");
        if (inner.length()) root = inner;
        BacOtaPayload parsed;
        if (!BacOtaPayload::parseFromJson(root, parsed)) {
            BacDebug::event("ota", "invalid payload");
            return;
        }
        _otaPayload = parsed;
        _otaCommandId = commandId;
        _otaPending = true;
        BacDebug::eventf("ota", "queued v=%s fw=%d assets=%d", _otaPayload.version, _otaPayload.hasFirmware() ? 1 : 0,
                         _otaPayload.hasAssets() ? 1 : 0);
    }

    void pollOtaPending() {
        if (_otaFailUntilMs != 0) {
            if (millis() < _otaFailUntilMs) return;
            _otaFailUntilMs = 0;
            _cloudClient.setOtaHold(false);
            enterIdle();
            return;
        }
        if (_otaAssetsDone) {
            _otaAssetsDone = false;
            _cloudClient.setOtaHold(false);
            if (!lucarne::volumeMounted()) {
                if (!lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat")) {
                    BacDebug::event("ota", "volume remount failed");
                }
            }
            reloadUserConfig();
            startMessageServer();
            enterIdle();
            return;
        }
        if (_otaFailed) {
            _otaFailed = false;
            projet::w90.setText(BacLocale::ota_failed);
            projet::w91.setText("");
            if (_ui) _ui->invalidate();
            _otaFailUntilMs = millis() + 6000;
            return;
        }
        if (!_otaPending || _otaRunning) return;
        if (!canRunOta()) return;
        _otaPending = false;
        startOtaUpdate();
    }

    void startOtaUpdate() {
        if (_otaRunning || !_otaPayload.valid()) return;
        if (_otaTask != nullptr) return;
        _otaRunning = true;
        _cloudClient.setOtaHold(true);
        stopMessageServer();
        goInstant(&projet::screen_scr_mr3hcyofj);
        projet::w90.setText(BacLocale::ota_progress);
        projet::w91.setText(BacLocale::ota_warn);
        if (_ui) _ui->invalidate();
        xTaskCreatePinnedToCore(&BacApp::otaTaskEntry, "bacOta", 16384, this, 2, &_otaTask, 1);
    }

    void onOtaProgress(int percent) {
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
        char buf[48];
        snprintf(buf, sizeof(buf), "%s %d%%", BacLocale::ota_progress, percent);
        projet::w90.setText(buf);
        if (_ui) _ui->invalidate();
    }

    void otaTaskBody() {
        bool needFw = _otaPayload.hasFirmware();
        if (needFw && _otaPayload.version[0] && strcmp(BAC_FW_VERSION, _otaPayload.version) == 0) {
            BacDebug::event("ota", "firmware skip, already current");
            needFw = false;
        }
        bool fwOk = true;
        bool shaFail = false;
        if (needFw) {
            fwOk = BacOta::installFromUrl(_otaPayload.fwUrl, _otaPayload.fwSize, _otaPayload.fwSha256,
                                            &BacApp::otaProgressThunk, this, &shaFail);
        }
        bool assetsOk = true;
        if (fwOk && _otaPayload.hasAssets()) {
            bool assetsShaFail = false;
            assetsOk = BacAssetsOta::installPackFromUrl(_otaPayload.assetsUrl, _otaPayload.assetsSize,
                                                        _otaPayload.assetsSha256, &BacApp::otaProgressThunk, this,
                                                        &assetsShaFail);
            if (assetsShaFail) shaFail = true;
        }
        bool ok = fwOk && assetsOk;
        uint32_t cmdId = _otaCommandId;
        if (ok && cmdId) _cloudClient.ackCommand(cmdId);
        if (!ok && cmdId) _cloudClient.failCommand(cmdId);
        if (!ok) {
            if (shaFail) {
                _otaShaFailCount++;
                if (_otaShaFailCount >= 3) {
                    _otaShaBackoffUntilMs = millis() + 300000;
                    _otaShaFailCount = 0;
                    BacDebug::event("ota", "sha backoff 5 min");
                }
            }
            BacDebug::eventf("ota", "failed v=%s", _otaPayload.version);
        } else {
            _otaShaFailCount = 0;
            BacDebug::eventf("ota", "success v=%s reboot=%d", _otaPayload.version, needFw ? 1 : 0);
        }
        _otaCommandId = 0;
        memset(&_otaPayload, 0, sizeof(_otaPayload));
        _otaTask = nullptr;
        _otaRunning = false;
        if (ok && needFw) {
            lucarne::unmountVolume();
            delay(400);
            ESP.restart();
        } else if (ok) {
            if (!lucarne::volumeMounted()) {
                if (!lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat")) {
                    BacDebug::event("ota", "volume remount failed");
                }
            }
            _otaAssetsDone = true;
        } else {
            lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
            _otaFailed = true;
        }
        vTaskDelete(nullptr);
    }

    void onCloudConfig(const char *json) {
        onCloudCommand(json);
    }

    void onBleConfig(const char *payload) {
        if (!payload || !payload[0]) return;
        char raw[192];
        strncpy(raw, payload, sizeof(raw) - 1);
        raw[sizeof(raw) - 1] = 0;
        char *p1 = strchr(raw, '|');
        if (p1) *p1 = 0;
        char *p2 = p1 ? strchr(p1 + 1, '|') : nullptr;
        if (p2) *p2 = 0;
        if (raw[0]) {
            _config.displayName = String(raw);
            applyDeviceName();
        }
        if (p1 && p1[1]) _config.locale = String(p1 + 1);
        if (p2 && p2[1]) _config.region = String(p2 + 1);
        _config.save();
        applyUiLocale();
        updateClockLabels(true);
        BAC_LOG("ble", "config updated");
    }

    void pollMenuActions() {
        if (!_ui) return;
        uint8_t id = _ui->pollMenuAction();
        if (id == 0) return;
        if (id == ACTION_SETTINGS_DISCONNECT_CONFIRM) {
            startDisconnectFlow();
        }
    }

    void onScreenEnter(lucarne::Screen *screen) {
        if (!screen || !screen->name()) return;
        if (strcmp(screen->name(), "settings_informations") == 0) {
            bindSettingsInfo();
        }
        if (strcmp(screen->name(), "settings_wifi") == 0) {
            projet::w51.setText(_config.ssid.length() ? _config.ssid.c_str() : "-");
        }
        if (strcmp(screen->name(), "first_p3") == 0) {
            applyDeviceName();
        }
        if (strcmp(screen->name(), "settings_date_hours") == 0) {
            projet::w52.setSelected(localeMenuIndex());
        }
        if (strcmp(screen->name(), "settings_wifi_test") == 0) {
            startWifiTestFlow();
        }
        if (strcmp(screen->name(), "settings_fatory_reseting") == 0) {
            startFactoryResetFlow();
        }
        if (strcmp(screen->name(), "idle") == 0 && _mode == Mode::Settings) {
            _mode = Mode::Idle;
        }
    }

    void onWifiProvision(const char *ssid, const char *pass) {
        if (!ssid || !ssid[0]) return;
        if (_provPending || _wifiAttemptActive) return;
        strncpy(_provSsid, ssid, PROV_SSID_MAX);
        _provSsid[PROV_SSID_MAX] = 0;
        strncpy(_provPass, pass ? pass : "", PROV_PASS_MAX);
        _provPass[PROV_PASS_MAX] = 0;
        _provPending = true;
    }

    void pollPendingWifiProv() {
        if (!_provPending) return;
        if (_wifiAttemptActive) return;
        _provPending = false;
        BAC_LOGF("wifi", "creds ssid=%s", _provSsid);
        _pendingSsid = _provSsid;
        _pendingPass = _provPass;
        if (_mode == Mode::FirstSetup && _first == FirstStep::P3) {
            _first = FirstStep::WifiConnecting;
            setSsidLabels(_provSsid);
            go(&projet::screen_scr_mqzxocmh1e);
            startWifiAttempt(_provSsid, _provPass, true);
            return;
        }
        if (_mode == Mode::Lost || (_mode == Mode::FirstSetup && _first == FirstStep::WifiError)) {
            setSsidLabels(_provSsid);
            if (_mode == Mode::FirstSetup) {
                _first = FirstStep::WifiConnecting;
                go(&projet::screen_scr_mqzxocmh1e);
                startWifiAttempt(_provSsid, _provPass, true);
            } else {
                go(&projet::screen_scr_mqzxocmh1e);
                startWifiAttempt(_provSsid, _provPass, false);
            }
        }
    }

    void startWifiAttempt(const char *ssid, const char *pass, bool firstSetupMinDelay) {
        strncpy(_connectSsid, ssid ? ssid : "", PROV_SSID_MAX);
        _connectSsid[PROV_SSID_MAX] = 0;
        strncpy(_connectPass, pass ? pass : "", PROV_PASS_MAX);
        _connectPass[PROV_PASS_MAX] = 0;
        _wifiAttemptActive = true;
        _wifiConnectStartedMs = millis();
        _wifiScreenStartedMs = millis();
        _wifiFirstSetupMin = firstSetupMinDelay;
        _ble.setProvisionStatus(BacBle::PROV_CONNECTING);
        if (_ble.isAppConnected()) vTaskDelay(pdMS_TO_TICKS(1200));
        else vTaskDelay(pdMS_TO_TICKS(500));
        _wifi.startConnect(_connectSsid, _connectPass, _ble.isAppConnected());
        BAC_LOGF("wifi", "connecting ssid=%s ble=%d", _connectSsid, _ble.isAppConnected() ? 1 : 0);
    }

    void pollWifiConnectingWatchdog() {
        if (_mode != Mode::FirstSetup || _first != FirstStep::WifiConnecting) return;
        if (_wifiAttemptActive) return;
        if (_wifiScreenStartedMs == 0) return;
        if (millis() - _wifiScreenStartedMs < wifiConnectTimeoutMs()) return;
        BAC_LOG("wifi", "watchdog");
        onWifiFailure();
    }

    void pollWifi() {
        if (!_wifiAttemptActive) return;
        uint32_t now = millis();
        uint32_t elapsed = now - _wifiConnectStartedMs;
        bool minDone = !_wifiFirstSetupMin || (now - _wifiScreenStartedMs >= WIFI_CONNECT_MIN_MS);
        if (!minDone) return;

        if (_wifi.connected()) {
            _wifiAttemptActive = false;
            onWifiSuccess();
            return;
        }

        uint32_t limit = (_mode == Mode::WifiBoot) ? WIFI_BOOT_TIMEOUT_MS : wifiConnectTimeoutMs();
        if (elapsed < limit) return;

        _wifiAttemptActive = false;
        onWifiFailure();
    }

    void pollWifiLink() {
        bool monitor = _mode == Mode::Idle && _config.wifiConfigured() && !_wifiAttemptActive;
        _wifi.pollLink(millis(), monitor);
    }

    void onWifiLinkLost() {
        if (_mode != Mode::Idle) return;
        if (_wifiAttemptActive) return;
        BAC_LOG("wifi", "link lost");
        enterLost();
        openBleProvisioning();
    }

    uint32_t wifiConnectTimeoutMs() const {
        uint32_t t = WIFI_CONNECT_MIN_MS + 20000;
        if (_ble.isAppConnected() || _wifi.bleContention()) t += WIFI_CONNECT_BLE_EXTRA_MS;
        return t;
    }

    void onWifiSuccess() {
        _wifi.finishConnectAttempt();
        BAC_LOGF("wifi", "ok ip=%s", WiFi.localIP().toString().c_str());
        _config.ssid = _pendingSsid.length() ? _pendingSsid : _config.ssid;
        _config.psw = _pendingPass.length() ? _pendingPass : _config.psw;
        if (_pendingSsid.length()) {
            _config.save();
            _pendingSsid = "";
            _pendingPass = "";
        }
        _wifi.markStationUp();
        _cloudClient.onWifiConnected();
        _ble.setProvisionStatus(BacBle::PROV_OK);
        vTaskDelay(pdMS_TO_TICKS(1200));
        closeBleProvisioning(true);
        if (_mode == Mode::FirstSetup) {
            _config.configured = true;
            _config.save();
            _first = FirstStep::P4;
            _p4ShownMs = millis();
            _touchEnabled = true;
            armTouch(TOUCH_ARM_NAV_MS, true);
            go(&projet::screen_scr_mqzx2k8qz);
            startNtp();
            return;
        }
        startNtp();
        enterIdle();
    }

    void onWifiFailure() {
        BAC_LOGF("wifi", "failed reason=%u ble=%d", _wifi.lastDisconnectReason(), _ble.isAppConnected() ? 1 : 0);
        _wifi.finishConnectAttempt();
        _wifi.markStationDown();
        _ble.setProvisionStatus(BacBle::PROV_FAIL);
        const char *ssid = _pendingSsid.length() ? _pendingSsid.c_str() : _config.ssid.c_str();
        setSsidLabels(ssid);
        if (_mode == Mode::FirstSetup) {
            _first = FirstStep::WifiError;
            go(&projet::screen_scr_mqzxihlp18);
            if (!_ble.isAppConnected()) openBleProvisioning();
            return;
        }
        enterLost();
        if (!_ble.isAppConnected()) openBleProvisioning();
    }

    void enterIdle() {
        if (_mode == Mode::FirstSetup) {
            _config.configured = true;
            _config.save();
        }
        _mode = Mode::Idle;
        _wasTouchPressed = false;
        _touchEnabled = true;
        closeBleProvisioning(false);
        go(&projet::screen_scr_mqzyaiw41j);
        updateClockLabels(true);
        startMessageServer();
        _cloudClient.onWifiConnected();
    }

    void enterLost() {
        _mode = Mode::Lost;
        _touchEnabled = true;
        stopMessageServer();
        _wifi.markStationDown();
        go(&projet::screen_scr_mqwqhtj72);
    }

    void startNtp() {
        if (_ntpStarted) return;
        int32_t offset = 0;
        if (_config.tzOffsetValid) {
            offset = _config.tzOffsetSec;
        } else if (_timeSync.fetchOffsetFromIp(offset)) {
            _config.tzOffsetSec = offset;
            _config.tzOffsetValid = true;
            _config.save();
            BAC_LOGF("time", "tz offset %ld", (long)offset);
        } else {
            offset = 0;
            BAC_LOG("time", "tz fallback UTC");
        }
        _timeSync.applyOffset(offset);
        _timeSync.waitForSync(10000);
        _ntpStarted = true;
    }

    bool lazyCacheAllowed() const {
        return _mode == Mode::Idle || _mode == Mode::Lost || _mode == Mode::FirstSetup ||
               _mode == Mode::Settings;
    }

    void pollP4() {
        if (_mode != Mode::FirstSetup || _first != FirstStep::P4) return;
        if (millis() - _p4ShownMs < P4_AUTO_IDLE_MS) return;
        enterIdle();
    }

    static bool touchSampleValid(uint32_t v) {
        return v >= TOUCH_VALID_MIN && v <= TOUCH_VALID_MAX;
    }

    static bool touchPressed(uint32_t v, bool wasPressed) {
        if (wasPressed) return v > TOUCH_RELEASE_MAX;
        return v >= TOUCH_PRESS_MIN;
    }

    void pollTouch(uint32_t v) {
        if (!touchSampleValid(v)) return;
        bool pressed = touchPressed(v, _wasTouchPressed);
        uint32_t now = millis();

        if (now < _touchArmUntilMs) {
            _wasTouchPressed = pressed;
            return;
        }

        if (_mode == Mode::FirstSetup) {
            if (pressed && !_wasTouchPressed) {
                if (_first == FirstStep::P1) {
                    _first = FirstStep::P2;
                    go(&projet::screen_scr_mqzwbobu5);
                    armTouch(TOUCH_ARM_NAV_MS, false);
                    BAC_LOG("setup", "first_p2");
                } else if (_first == FirstStep::P2) {
                    _first = FirstStep::P3;
                    applyDeviceName();
                    go(&projet::screen_scr_mqzwqllfl);
                    openBleProvisioning();
                    armTouch(TOUCH_ARM_NAV_MS, false);
                    BAC_LOG("setup", "first_p3");
                } else if (_first == FirstStep::P4) {
                    enterIdle();
                }
            }
            _wasTouchPressed = pressed;
            return;
        }

        if (onCurrentScreen("new_message") && _msgStore.hasMessage()) {
            if (pressed && !_wasTouchPressed) {
                _touchPressStartMs = now;
            }
            if (!pressed && _wasTouchPressed) {
                uint32_t dur = now - _touchPressStartMs;
                if (dur < TAP_MAX_MS) {
                    openMessageView();
                    _wasTouchPressed = pressed;
                    return;
                }
            }
        }

        if (settingsLongPressAllowed()) {
            if (pressed && !_wasTouchPressed) {
                _touchPressStartMs = now;
                _touchSelectFired = false;
                _touchSettingsFired = false;
            }
            if (pressed && !_touchSettingsFired && (now - _touchPressStartMs >= SETTINGS_OPEN_MS)) {
                _touchSettingsFired = true;
                enterSettings();
            }
        }

        if (settingsTouchAllowed()) {
            if (pressed && !_wasTouchPressed) {
                _touchPressStartMs = now;
                _touchSelectFired = false;
            }
            if (pressed && !_touchSelectFired && _ui->activeMenu() &&
                (now - _touchPressStartMs >= MENU_SELECT_HOLD_MS)) {
                _touchSelectFired = true;
                if (onCurrentScreen("settings_date_hours") && _ui->activeMenu() == &projet::w52) {
                    int idx = projet::w52.selectedIndex();
                    if (idx >= 0 && idx <= 5) applyLanguageFromMenu(idx);
                }
                _ui->select();
            }
            if (!pressed && _wasTouchPressed && !_touchSelectFired) {
                uint32_t dur = now - _touchPressStartMs;
                if (dur < TAP_MAX_MS && _ui->activeMenu()) {
                    _ui->next();
                }
            }
        } else if (_mode == Mode::Idle && onCurrentScreen("idle")) {
            if (!pressed && _wasTouchPressed && !_touchSettingsFired) {
                uint32_t dur = now - _touchPressStartMs;
                if (dur < TAP_MAX_MS) {
                    BAC_LOG("ui", "send heart");
                }
            }
        } else if (onCurrentScreen("message_opened")) {
            if (pressed && !_wasTouchPressed) {
                _touchPressStartMs = now;
            }
            if (!pressed && _wasTouchPressed) {
                uint32_t dur = now - _touchPressStartMs;
                if (dur < TAP_MAX_MS) {
                    enterIdle();
                }
            }
        }

        _wasTouchPressed = pressed;
    }

    void armTouch(uint32_t ms, bool resetState) {
        _touchArmUntilMs = millis() + ms;
        if (resetState) _wasTouchPressed = false;
    }

    void pollClock() {
        if (_mode != Mode::Idle) return;
        uint32_t now = millis();
        if (now - _lastClockUpdateMs < 1000) return;
        _lastClockUpdateMs = now;
        updateClockLabels(false);
    }

    void updateClockLabels(bool forceRedraw) {
        struct tm ti;
        if (!getLocalTime(&ti, 0)) {
            if (!forceRedraw) return;
            _clockTimeText = "00:00";
            _clockDateText = "-- -- ----";
        } else {
            char tb[8];
            snprintf(tb, sizeof(tb), "%02d:%02d", ti.tm_hour, ti.tm_min);
            _clockTimeText = tb;
            int dow = ti.tm_wday;
            int mon = ti.tm_mon;
            if (dow < 0 || dow > 6) dow = 0;
            if (mon < 0 || mon > 11) mon = 0;
            char db[32];
            snprintf(db, sizeof(db), "%s %d %s", BacLocale::dayName(dow), ti.tm_mday, BacLocale::monthName(mon));
            _clockDateText = db;
        }
        projet::w43.setText(_clockTimeText.c_str());
        projet::w46.setText(_clockDateText.c_str());
        if (_msgStore.hasMessage()) {
            projet::w44.setText(BacLocale::new_message);
        } else {
            projet::w44.setText(BacLocale::idle_no_msg);
        }
        if (_ui->current() == &projet::screen_scr_mqzyaiw41j) {
            _ui->invalidate();
        }
    }

    void applyDeviceName() {
        _deviceLabelText = _config.labelName();
        projet::w28.setText(_deviceLabelText.c_str());
        if (_ui) _ui->invalidate();
    }

    void bindSettingsInfo() {
        projet::w73.setText(BAC_FW_VERSION);
        _infoBuildText = _config.buildYear.length() ? _config.buildYear : "-";
        if (_config.buildSemester.length()) _infoBuildText += String(" R") + _config.buildSemester;
        projet::w78.setText(_infoBuildText.c_str());
        projet::w79.setText(_config.hwRevision.length() ? _config.hwRevision.c_str() : "BaC");
        uint8_t mac[6];
        WiFi.macAddress(mac);
        char macBuf[18];
        snprintf(macBuf, sizeof(macBuf), "%02X:%02X:%02X:%02X:%02X:%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        projet::w80.setText(macBuf);
        applyDeviceName();
    }

    void setSsidLabels(const char *ssid) {
        if (!ssid) ssid = "";
        projet::w36.setText(ssid);
        projet::w40.setText(ssid);
        projet::w51.setText(ssid);
    }

    void applyUiLocale() {
        BacLocale::prepare(_config.locale.c_str());
        projet::w0.setText(BacLocale::lost_title);
        projet::w1.setText(BacLocale::lost_l1);
        projet::w2.setText(BacLocale::lost_l2);
        projet::w3.setText(BacLocale::lost_l3);
        projet::w4.setText(BacLocale::lost_l4);
        projet::w5.setText(BacLocale::lost_l5);
        projet::w6.setText(BacLocale::lost_l6);
        projet::w8.setText(BacLocale::splash_boot);
        projet::w11.setText(BacLocale::welcome_l1);
        projet::w12.setText(BacLocale::welcome_l2);
        projet::w14.setText(BacLocale::next);
        projet::w17.setText(BacLocale::new_message);
        projet::w19.setText(BacLocale::open_msg);
        projet::w21.setText(BacLocale::dl_app);
        projet::w22.setText(BacLocale::dl_app2);
        projet::w24.setText(BacLocale::next);
        projet::w26.setText(BacLocale::bt_l3);
        projet::w27.setText(BacLocale::bt_l1);
        projet::w30.setText(BacLocale::bt_l4);
        projet::w31.setText(BacLocale::bravo);
        projet::w33.setText(BacLocale::done_l1);
        projet::w34.setText(BacLocale::done_l2);
        projet::w35.setText(BacLocale::wifi_err_title);
        projet::w37.setText(BacLocale::wifi_err_hint);
        projet::w39.setText(BacLocale::wifi_conn_title);
        projet::w41.setText(BacLocale::wifi_conn_progress);
        projet::w45.setText(BacLocale::idle_send_heart);
        projet::w54.setText(BacLocale::disc_q1);
        projet::w55.setText(BacLocale::disc_q2);
        projet::w56.setText(BacLocale::disc_q3);
        projet::w57.setText(BacLocale::disc_progress);
        projet::w59.setText(BacLocale::disc_done);
        projet::w60.setText(BacLocale::disc_need1);
        projet::w61.setText(BacLocale::disc_need2);
        projet::w62.setText(BacLocale::disc_need3);
        projet::w64.setText(BacLocale::wifi_test_progress);
        projet::w67.setText(BacLocale::wifi_test_ok);
        projet::w70.setText(BacLocale::wifi_test_fail1);
        projet::w71.setText(BacLocale::wifi_test_fail2);
        projet::w74.setText(BacLocale::info_fw);
        projet::w75.setText(BacLocale::info_build);
        projet::w76.setText(BacLocale::info_model);
        projet::w77.setText(BacLocale::info_mac);
        projet::w83.setText(BacLocale::factory_q1);
        projet::w84.setText(BacLocale::factory_q2);
        projet::w85.setText(BacLocale::factory_q3);
        projet::w86.setText(BacLocale::factory_q4);
        projet::w88.setText(BacLocale::factory_progress);
        projet::w89.setText(BacLocale::factory_warn);
        projet::w90.setText(BacLocale::ota_progress);
        projet::w91.setText(BacLocale::ota_warn);
        if (_ui) _ui->invalidate();
    }

    int localeMenuIndex() const {
        if (_config.locale == "en") return 1;
        if (_config.locale == "it") return 2;
        if (_config.locale == "de") return 3;
        if (_config.locale == "pt") return 4;
        if (_config.locale == "es") return 5;
        return 0;
    }

    void applyLanguageFromMenu(int index) {
        switch (index) {
            case 0: _config.locale = "fr"; break;
            case 1: _config.locale = "en"; break;
            case 2: _config.locale = "it"; break;
            case 3: _config.locale = "de"; break;
            case 4: _config.locale = "pt"; break;
            case 5: _config.locale = "es"; break;
            default: return;
        }
        _config.save();
        applyUiLocale();
        updateClockLabels(true);
        BAC_LOGF("locale", "set %s", _config.locale.c_str());
    }

    void go(lucarne::Screen *screen) {
        if (!screen || !_ui) return;
        if (_ui->current() == screen) return;
        if (_cache && _ui->current()) {
            _cache->warmIfNeeded(screen, _ui->current());
        }
        if (!_ui->current()) {
            _ui->show(screen);
        } else {
            _ui->navigate(screen, lucarne::Transition::Inherit);
        }
        if (_cache) _cache->onVisible(screen);
        _lastScreen = screen;
        onScreenEnter(screen);
    }

    void goInstant(lucarne::Screen *screen) {
        if (!screen || !_ui) return;
        if (_ui->current() == screen) return;
        if (_cache && _ui->current()) {
            _cache->warmIfNeeded(screen, _ui->current());
        }
        if (!_ui->current()) {
            _ui->show(screen);
        } else {
            _ui->navigate(screen, lucarne::Transition::None);
        }
        if (_cache) _cache->onVisible(screen);
        _lastScreen = screen;
        onScreenEnter(screen);
    }

    lucarne::UI *_ui = nullptr;
    BacScreenCache *_cache = nullptr;
    BacUserConfig _config;
    BacBle _ble;
    BacWifi _wifi;
    BacTimeSync _timeSync;
    BacMessageStore _msgStore;
    BacMessageServer _msgServer;
    BacMessageRenderer _msgRenderer;
    BacCloudClient _cloudClient;
    Mode _mode = Mode::Caching;
    FirstStep _first = FirstStep::P1;
    PendingFlow _pendingFlow = PendingFlow::None;
    bool _touchEnabled = false;
    bool _ntpStarted = false;
    bool _wifiAttemptActive = false;
    bool _wifiFirstSetupMin = false;
    bool _wifiTestDone = false;
    bool _wifiTestOk = false;
    bool _httpStarted = false;
    bool _pendingMsg = false;
    uint32_t _pendingCloudAckId = 0;
    uint8_t *_pendingMsgBuf = nullptr;
    size_t _pendingMsgLen = 0;
    bool _wasTouchPressed = false;
    bool _touchSelectFired = false;
    bool _touchSettingsFired = false;
    uint32_t _touchArmUntilMs = 0;
    uint32_t _touchPressStartMs = 0;
    uint32_t _wifiConnectStartedMs = 0;
    uint32_t _wifiScreenStartedMs = 0;
    uint32_t _lastClockUpdateMs = 0;
    uint32_t _p4ShownMs = 0;
    uint32_t _flowStartedMs = 0;
    lucarne::Screen *_lastScreen = nullptr;
    volatile bool _provPending = false;
    char _provSsid[PROV_SSID_MAX + 1];
    char _provPass[PROV_PASS_MAX + 1];
    char _connectSsid[PROV_SSID_MAX + 1];
    char _connectPass[PROV_PASS_MAX + 1];
    String _pendingSsid;
    String _pendingPass;
    String _clockTimeText;
    String _clockDateText;
    String _deviceLabelText;
    String _infoBuildText;
    volatile bool _otaPending = false;
    volatile bool _otaRunning = false;
    volatile bool _otaFailed = false;
    volatile bool _otaAssetsDone = false;
    uint32_t _otaCommandId = 0;
    uint32_t _otaFailUntilMs = 0;
    uint32_t _otaShaBackoffUntilMs = 0;
    uint8_t _otaShaFailCount = 0;
    BacOtaPayload _otaPayload = {};
    TaskHandle_t _otaTask = nullptr;
};

#else

#include "Projet.h"

class BacApp {
public:
    void begin(lucarne::UI &, BacScreenCache &) {}
    void onCacheReady() {}
    void tick(uint32_t) {}
    bool touchEnabled() const { return false; }
    int firstSetupStep() const { return 0; }
    void openBleProvisioning() {}
    void closeBleProvisioning(bool = true) {}
    bool bleProvisioningActive() const { return false; }
    bool wifiConnected() const { return false; }
    void requestWifiReconnect() {}
    void forgetWifiAndReprovision() {}
    void onLostConnectionScreen() {}
    void drawMessageOverlay(lucarne::Display &) {}
    bool messageViewActive() const { return false; }
    bool hasPendingMessage() const { return false; }
};

#endif
