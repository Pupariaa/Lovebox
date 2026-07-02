#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include "BacDebug.h"
#include "BacMessageStore.h"
#include "BacUserConfig.h"

class BacMessageServer {
public:
    typedef void (*MessageReceivedFn)(void *ctx, uint8_t *data, size_t len);

    static const uint16_t PORT = 8080;

    void begin(BacMessageStore *, BacUserConfig *config, MessageReceivedFn fn, void *ctx) {
        _config = config;
        _handler = fn;
        _handlerCtx = ctx;
        if (_running) return;
        static const char *hdrKeys[] = {"Content-Length"};
        _server.collectHeaders(hdrKeys, 1);
        _server.on("/ping", HTTP_GET, [this]() { _server.send(200, "text/plain", "ok"); });
        _server.on("/info", HTTP_GET, [this]() { sendInfo(); });
        _server.on(
            "/message",
            HTTP_POST,
            [this]() { finishMessagePost(); },
            [this]() { handleMessageUpload(); });
        _server.begin(PORT);
        _running = true;
        BAC_LOGF("http", "server started on :%u", (unsigned)PORT);
    }

    void stop() {
        if (!_running) return;
        resetRx();
        _server.stop();
        _running = false;
    }

    void tick() { _server.handleClient(); }

    bool running() const { return _running; }

private:
    void sendInfo() {
        if (!_config) {
            _server.send(500, "application/json", "{}");
            return;
        }
        String body = "{\"name\":\"";
        body += _config->deviceName;
        body += "\",\"uuid\":\"";
        body += _config->uuid;
        body += "\",\"ip\":\"";
        body += WiFi.localIP().toString();
        body += "\",\"w\":280,\"h\":240,\"port\":";
        body += PORT;
        body += "}";
        _server.send(200, "application/json", body);
    }

    void resetRx() {
        if (_rxBuf) {
            heap_caps_free(_rxBuf);
            _rxBuf = nullptr;
        }
        _rxLen = 0;
        _rxCap = 0;
    }

    uint8_t *allocCopy(const uint8_t *data, size_t len) {
        if (!data || len == 0) return nullptr;
        uint8_t *copy = (uint8_t *)heap_caps_malloc(len, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!copy) copy = (uint8_t *)heap_caps_malloc(len, MALLOC_CAP_8BIT);
        if (!copy) return nullptr;
        memcpy(copy, data, len);
        return copy;
    }

    bool ensureRxCap(size_t need) {
        if (need > BacMessageStore::MAX_MESSAGE_BYTES) return false;
        if (_rxBuf && _rxCap >= need) return true;
        uint8_t *next = (uint8_t *)heap_caps_malloc(need, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!next) next = (uint8_t *)heap_caps_malloc(need, MALLOC_CAP_8BIT);
        if (!next) return false;
        if (_rxBuf && _rxLen > 0) memcpy(next, _rxBuf, _rxLen);
        if (_rxBuf) heap_caps_free(_rxBuf);
        _rxBuf = next;
        _rxCap = need;
        return true;
    }

    void handleMessageUpload() {
        HTTPUpload &up = _server.upload();
        if (up.status == UPLOAD_FILE_START) {
            resetRx();
        } else if (up.status == UPLOAD_FILE_WRITE) {
            size_t n = up.currentSize;
            if (n == 0) return;
            if (_rxLen + n > BacMessageStore::MAX_MESSAGE_BYTES) return;
            if (!ensureRxCap(_rxLen + n)) return;
            memcpy(_rxBuf + _rxLen, up.buf, n);
            _rxLen += n;
        }
    }

    void finishMessagePost() {
        if (_rxBuf && _rxLen > 0) {
            handleBody(_rxBuf, _rxLen);
            return;
        }

        if (_server.hasArg("plain")) {
            String body = _server.arg("plain");
            size_t len = body.length();
            if (len > 0 && len <= BacMessageStore::MAX_MESSAGE_BYTES) {
                uint8_t *copy = allocCopy((const uint8_t *)body.c_str(), len);
                if (!copy) {
                    _server.send(507, "application/json", "{\"ok\":false,\"error\":\"no memory\"}");
                    return;
                }
                handleBody(copy, len);
                return;
            }
        }

        size_t len = (size_t)_server.header("Content-Length").toInt();
        if (len == 0 || len > BacMessageStore::MAX_MESSAGE_BYTES) {
            _server.send(400, "application/json", "{\"ok\":false,\"error\":\"bad length\"}");
            return;
        }
        if (!ensureRxCap(len)) {
            _server.send(507, "application/json", "{\"ok\":false,\"error\":\"no memory\"}");
            return;
        }
        WiFiClient client = _server.client();
        size_t pos = 0;
        uint32_t t0 = millis();
        while (pos < len && millis() - t0 < 30000) {
            if (client.available()) {
                int n = client.read(_rxBuf + pos, len - pos);
                if (n > 0) pos += (size_t)n;
            } else {
                delay(1);
                yield();
            }
        }
        if (pos < len) {
            resetRx();
            _server.send(408, "application/json", "{\"ok\":false,\"error\":\"timeout\"}");
            return;
        }
        _rxLen = len;
        handleBody(_rxBuf, _rxLen);
    }

    void handleBody(uint8_t *data, size_t len) {
        if (!data || len == 0) {
            _server.send(400, "application/json", "{\"ok\":false,\"error\":\"empty\"}");
            return;
        }
        if (!_handler) {
            heap_caps_free(data);
            if (data == _rxBuf) resetRx();
            _server.send(500, "application/json", "{\"ok\":false,\"error\":\"no handler\"}");
            return;
        }
        _handler(_handlerCtx, data, len);
        if (data == _rxBuf) {
            _rxBuf = nullptr;
            _rxLen = 0;
            _rxCap = 0;
        }
        _server.send(200, "application/json", "{\"ok\":true}");
    }

    WebServer _server{PORT};
    BacUserConfig *_config = nullptr;
    MessageReceivedFn _handler = nullptr;
    void *_handlerCtx = nullptr;
    uint8_t *_rxBuf = nullptr;
    size_t _rxLen = 0;
    size_t _rxCap = 0;
    bool _running = false;
};

#else

class BacMessageServer {
public:
    typedef void (*MessageReceivedFn)(void *, uint8_t *, size_t);
    void begin(BacMessageStore *, BacUserConfig *, MessageReceivedFn, void *) {}
    void stop() {}
    void tick() {}
    bool running() const { return false; }
};

#endif
