#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <string.h>

class BacBle {
public:
    static const uint32_t SHUTDOWN_DELAY_MS = 350;

    static const uint8_t PROV_IDLE = 0;
    static const uint8_t PROV_CONNECTING = 1;
    static const uint8_t PROV_OK = 2;
    static const uint8_t PROV_FAIL = 3;

    typedef void (*WifiProvHandler)(const char *ssid, const char *pass, void *ctx);

    bool begin(const char *deviceName, const char *serialNumber = nullptr) {
        if (deviceName && strlen(deviceName) > 0) _deviceName = deviceName;
        if (serialNumber) _serialNumber = serialNumber;
        if (_deviceName.length() == 0) return false;
        if (_ready) {
            syncIdentityCharacteristic();
            return true;
        }
        BLEDevice::init(_deviceName.c_str());
        _server = BLEDevice::createServer();
        _server->setCallbacks(&_serverCb);
        _serverCb.owner = this;
        BLEService *service = _server->createService("bac1c201-1fb5-459e-8fcc-c5c9c331914b");
        _wifiChr = service->createCharacteristic(
            "bac1c202-36e1-4688-b7f5-ea07361b26a8",
            BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
        _wifiChr->setCallbacks(&_wifiCb);
        _wifiCb.owner = this;
        _statusChr = service->createCharacteristic(
            "bac1c203-36e1-4688-b7f5-ea07361b26a8",
            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
        _statusChr->addDescriptor(new BLE2902());
        _infoChr = service->createCharacteristic(
            "bac1c204-36e1-4688-b7f5-ea07361b26a8",
            BLECharacteristic::PROPERTY_READ);
        syncIdentityCharacteristic();
        service->start();
        _adv = BLEDevice::getAdvertising();
        _adv->addServiceUUID("bac1c201-1fb5-459e-8fcc-c5c9c331914b");
        _adv->setScanResponse(true);
        _adv->setMinPreferred(0x06);
        _adv->setMaxPreferred(0x12);
        BLEAdvertisementData advData;
        advData.setFlags(0x06);
        advData.setName(_deviceName.c_str());
        _adv->setAdvertisementData(advData);
        BLEAdvertisementData scanData;
        scanData.setName(_deviceName.c_str());
        scanData.setCompleteServices(BLEUUID("bac1c201-1fb5-459e-8fcc-c5c9c331914b"));
        _adv->setScanResponseData(scanData);
        _ready = true;
        setProvisionStatus(PROV_IDLE);
        return true;
    }

    void setWifiHandler(WifiProvHandler fn, void *ctx) {
        _handler = fn;
        _handlerCtx = ctx;
    }

    void poll() {
        if (!_shutdownPending || !_ready) return;
        if (_clientConnected) return;
        if (millis() < _shutdownDueMs) return;
        shutdownNow();
    }

    void openProvisioning() {
        _provisionWanted = true;
        _shutdownPending = false;
        _shutdownAfterDisconnect = false;
        if (!_ready && !begin(_deviceName.c_str(), _serialNumber.c_str())) return;
        setProvisionStatus(PROV_IDLE);
        startAdvertising();
    }

    void closeProvisioning(bool powerDown = true) {
        stopAdvertising();
        if (!powerDown) return;
        _provisionWanted = false;
        if (_clientConnected) {
            _shutdownAfterDisconnect = true;
            _shutdownPending = false;
            return;
        }
        requestShutdown();
    }

    void holdForAppSession(bool hold) {
        if (hold) {
            _shutdownPending = false;
            _shutdownAfterDisconnect = false;
            _provisionWanted = true;
        }
    }

    void setProvisionStatus(uint8_t code) {
        _statusCode = code;
        if (!_ready || !_statusChr) return;
        _statusChr->setValue(&_statusCode, 1);
        _statusChr->notify();
    }

    uint8_t provisionStatus() const { return _statusCode; }

    void requestShutdown() {
        if (!_ready) {
            _shutdownPending = false;
            return;
        }
        if (_clientConnected) {
            _shutdownAfterDisconnect = true;
            _shutdownPending = false;
            return;
        }
        stopAdvertising();
        _shutdownPending = true;
        _shutdownDueMs = millis() + SHUTDOWN_DELAY_MS;
    }

    void shutdownNow() {
        if (_clientConnected) {
            _shutdownAfterDisconnect = true;
            return;
        }
        stopAdvertising();
        if (!_ready) {
            _shutdownPending = false;
            return;
        }
        BLEDevice::deinit(true);
        _server = nullptr;
        _wifiChr = nullptr;
        _statusChr = nullptr;
        _infoChr = nullptr;
        _adv = nullptr;
        _ready = false;
        _shutdownPending = false;
    }

    bool isReady() const { return _ready; }
    bool isAdvertising() const { return _advertising; }
    bool shutdownPending() const { return _shutdownPending; }
    bool provisioningWanted() const { return _provisionWanted; }
    bool provisioningActive() const { return _provisionWanted && (_advertising || _ready); }
    bool isAppConnected() const { return _clientConnected; }

    void startAdvertising() {
        if (!_ready || _advertising || !_provisionWanted) return;
        BLEDevice::startAdvertising();
        _advertising = true;
    }

    void stopAdvertising() {
        if (!_ready || !_advertising) return;
        BLEDevice::stopAdvertising();
        _advertising = false;
    }

private:
    void syncIdentityCharacteristic() {
        if (!_infoChr) return;
        String payload = _deviceName;
        payload += "|";
        payload += _serialNumber;
        _infoChr->setValue(payload.c_str());
    }

    static void trimInPlace(char *s) {
        if (!s) return;
        char *start = s;
        while (*start == ' ' || *start == '\t' || *start == '\r') start++;
        if (start != s) memmove(s, start, strlen(start) + 1);
        size_t n = strlen(s);
        while (n > 0 && (s[n - 1] == ' ' || s[n - 1] == '\t' || s[n - 1] == '\r')) {
            s[n - 1] = 0;
            n--;
        }
    }

    class ServerCallbacks : public BLEServerCallbacks {
    public:
        BacBle *owner = nullptr;
        void onConnect(BLEServer *) override {
            if (!owner) return;
            owner->_clientConnected = true;
            owner->_shutdownAfterDisconnect = false;
            owner->_shutdownPending = false;
            owner->_provisionWanted = true;
            owner->stopAdvertising();
        }
        void onDisconnect(BLEServer *) override {
            if (!owner) return;
            owner->_clientConnected = false;
            if (owner->_shutdownAfterDisconnect) {
                owner->_shutdownAfterDisconnect = false;
                owner->requestShutdown();
                return;
            }
            if (owner->_provisionWanted) owner->startAdvertising();
        }
    };

    class WifiCallbacks : public BLECharacteristicCallbacks {
    public:
        BacBle *owner = nullptr;
        void onWrite(BLECharacteristic *chr) override {
            if (!owner || !owner->_handler) return;
            size_t len = chr->getLength();
            if (len == 0 || len > 127) return;
            char raw[128];
            memcpy(raw, chr->getData(), len);
            raw[len] = 0;
            trimInPlace(raw);
            if (raw[0] == 0) return;

            char ssid[33];
            char pass[64];
            ssid[0] = 0;
            pass[0] = 0;

            char *nl = strchr(raw, '\n');
            if (nl) {
                *nl = 0;
                strncpy(ssid, raw, 32);
                strncpy(pass, nl + 1, 63);
            } else {
                char *sep = strchr(raw, '|');
                if (!sep) return;
                *sep = 0;
                strncpy(ssid, raw, 32);
                strncpy(pass, sep + 1, 63);
            }
            ssid[32] = 0;
            pass[63] = 0;
            trimInPlace(ssid);
            trimInPlace(pass);
            if (ssid[0] == 0) return;
            owner->setProvisionStatus(PROV_CONNECTING);
            owner->_handler(ssid, pass, owner->_handlerCtx);
        }
    };

    String _deviceName;
    String _serialNumber;
    BLEServer *_server = nullptr;
    BLECharacteristic *_wifiChr = nullptr;
    BLECharacteristic *_statusChr = nullptr;
    BLECharacteristic *_infoChr = nullptr;
    BLEAdvertising *_adv = nullptr;
    ServerCallbacks _serverCb;
    WifiCallbacks _wifiCb;
    WifiProvHandler _handler = nullptr;
    void *_handlerCtx = nullptr;
    uint8_t _statusCode = PROV_IDLE;
    bool _ready = false;
    bool _advertising = false;
    bool _provisionWanted = false;
    bool _clientConnected = false;
    bool _shutdownAfterDisconnect = false;
    bool _shutdownPending = false;
    uint32_t _shutdownDueMs = 0;
};

#else

class BacBle {
public:
    static const uint8_t PROV_IDLE = 0;
    static const uint8_t PROV_CONNECTING = 1;
    static const uint8_t PROV_OK = 2;
    static const uint8_t PROV_FAIL = 3;
    typedef void (*WifiProvHandler)(const char *, const char *, void *);
    bool begin(const char *, const char * = nullptr) { return false; }
    void setWifiHandler(WifiProvHandler, void *) {}
    void poll() {}
    void openProvisioning() {}
    void closeProvisioning(bool = true) {}
    void holdForAppSession(bool) {}
    void setProvisionStatus(uint8_t) {}
    uint8_t provisionStatus() const { return PROV_IDLE; }
    void requestShutdown() {}
    void shutdownNow() {}
    bool isReady() const { return false; }
    bool isAdvertising() const { return false; }
    bool shutdownPending() const { return false; }
    bool provisioningWanted() const { return false; }
    bool provisioningActive() const { return false; }
    bool isAppConnected() const { return false; }
};

#endif
