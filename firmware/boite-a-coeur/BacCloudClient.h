#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <esp_heap_caps.h>
#include "BacUserConfig.h"
#include "BacFirmware.h"
#include "BacDebug.h"
#include "BacTls.h"
#include "BacUrlFailover.h"
#include "BacMessageStore.h"

class BacCloudClient {
public:
    static const uint32_t POLL_TIMEOUT_SEC = 25;
    static const uint32_t HTTP_TIMEOUT_MS = 32000;
    static const uint32_t HEARTBEAT_INTERVAL_MS = 60000;
    static const size_t MAX_MSG = 3145728;
    static const size_t MAX_CMD_BODY = 16384;

    class PollBodyStream : public Stream {
    public:
        void reset(uint8_t *buf, size_t cap) {
            _buf = buf;
            _cap = cap;
            _len = 0;
        }

        size_t length() const { return _len; }

        size_t write(uint8_t b) override {
            if (!_buf || _len >= _cap) return 0;
            _buf[_len++] = b;
            return 1;
        }

        size_t write(const uint8_t *buffer, size_t size) override {
            if (!_buf || !buffer || size == 0) return 0;
            size_t n = size;
            if (_len + n > _cap) n = _cap - _len;
            if (n == 0) return 0;
            memcpy(_buf + _len, buffer, n);
            _len += n;
            return n;
        }

        int available() override { return 0; }
        int read() override { return -1; }
        int peek() override { return -1; }
        void flush() override {}

    private:
        uint8_t *_buf = nullptr;
        size_t _cap = 0;
        size_t _len = 0;
    };

    typedef void (*MessageReceivedFn)(void *ctx, uint8_t *data, size_t len, uint32_t messageId, uint32_t displayDurationSec);
    typedef void (*ConfigCommandFn)(void *ctx, const char *payloadJson);
    typedef void (*OtaOfferFn)(void *ctx, const char *payloadJson);

    void begin(BacUserConfig *config, MessageReceivedFn fn, void *ctx) {
        _config = config;
        _handler = fn;
        _handlerCtx = ctx;
        if (!_queue) _queue = xQueueCreate(2, sizeof(IncomingMsg));
        if (!_taskStarted) {
            _taskStarted = true;
            xTaskCreatePinnedToCore(&BacCloudClient::taskEntry, "bacCloud", 8192, this, 1, &_task, 0);
        }
    }

    void onWifiConnected() {
        _registerPending = true;
        _registeredOk = false;
    }

    void tickIdle() {
        if (!_queue || !_handler) return;
        IncomingMsg msg;
        while (xQueueReceive(_queue, &msg, 0) == pdTRUE) {
            if (msg.data && msg.len > 0) {
                _handler(_handlerCtx, msg.data, msg.len, msg.messageId, msg.displayDurationSec);
            } else if (msg.data) heap_caps_free(msg.data);
        }
    }

    void ackMessage(uint32_t messageId) {
        if (!_config || !_config->apiSecret.length() || messageId == 0) return;
        PendingAck ack = {messageId};
        if (_ackQueue) xQueueSend(_ackQueue, &ack, 0);
    }

    void nackMessage(uint32_t messageId) {
        if (!_config || !_config->apiSecret.length() || messageId == 0) return;
        PendingNack nack = {messageId};
        if (_nackQueue) xQueueSend(_nackQueue, &nack, 0);
    }

    void setConfigCommandHandler(ConfigCommandFn fn, void *ctx) {
        _configHandler = fn;
        _configHandlerCtx = ctx;
    }

    void setOtaOfferHandler(OtaOfferFn fn, void *ctx) {
        _otaOfferHandler = fn;
        _otaOfferHandlerCtx = ctx;
    }

    void openedMessage(uint32_t messageId) {
        if (!_config || !_config->apiSecret.length() || messageId == 0) return;
        PendingMsgPost post = {messageId, MsgPostKind::Opened};
        if (_msgPostQueue) xQueueSend(_msgPostQueue, &post, 0);
    }

    void seenMessage(uint32_t messageId) {
        if (!_config || !_config->apiSecret.length() || messageId == 0) return;
        PendingMsgPost post = {messageId, MsgPostKind::Seen};
        if (_msgPostQueue) xQueueSend(_msgPostQueue, &post, 0);
    }

    void setMessageHold(bool hold) {
        _messageHold = hold;
    }

    void setOtaHold(bool hold) {
        _otaHold = hold;
    }

    bool ackCommand(uint32_t commandId) {
        if (!_config || !_config->apiSecret.length() || commandId == 0) return false;
        String url = apiBase() + "/api/v1/devices/commands/" + String(commandId) + "/ack";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return false;
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.POST((uint8_t *)nullptr, 0);
        http.end();
        return code == 200;
    }

    bool failCommand(uint32_t commandId) {
        if (!_config || !_config->apiSecret.length() || commandId == 0) return false;
        String url = apiBase() + "/api/v1/devices/commands/" + String(commandId) + "/fail";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return false;
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.POST((uint8_t *)nullptr, 0);
        http.end();
        return code == 200;
    }

    // Synchronous self-deletion: called at the very end of a factory reset while WiFi and the device
    // secret are still valid, so the backend can drop this device row (cascade removes pairings and
    // messages) before local credentials are wiped.
    bool deregisterDevice() {
        if (!_config || !_config->apiSecret.length()) return false;
        String url = apiBase() + "/api/v1/devices/deregister";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return false;
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.POST((uint8_t *)"{}", 2);
        http.end();
        return code >= 200 && code < 300;
    }

    static String unescapeJsonString(const String &s) {
        String out;
        out.reserve(s.length());
        for (unsigned int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c != '\\') {
                out += c;
                continue;
            }
            if (i + 1 >= s.length()) break;
            char n = s.charAt(i + 1);
            switch (n) {
                case '"': out += '"'; break;
                case '\\': out += '\\'; break;
                case '/': out += '/'; break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                default: out += n; break;
            }
            i++;
        }
        return out;
    }

    static String extractJsonString(const String &json, const char *key) {
        String needle = String("\"") + key + "\":\"";
        int idx = json.indexOf(needle);
        if (idx < 0) return "";
        idx += needle.length();
        int end = idx;
        while (end < (int)json.length()) {
            if (json.charAt(end) == '\\') {
                end += 2;
                continue;
            }
            if (json.charAt(end) == '"') break;
            end++;
        }
        if (end >= (int)json.length()) return "";
        return unescapeJsonString(json.substring(idx, end));
    }

    static String extractJsonObject(const String &json, const char *key) {
        String needle = String("\"") + key + "\":";
        int idx = json.indexOf(needle);
        if (idx < 0) return "";
        idx = json.indexOf('{', idx);
        if (idx < 0) return "";
        int depth = 0;
        for (unsigned int i = (unsigned int)idx; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) return json.substring(idx, (int)i + 1);
            }
        }
        return "";
    }

    static uint32_t extractJsonUInt(const String &json, const char *key) {
        String needle = String("\"") + key + "\":";
        int idx = json.indexOf(needle);
        if (idx < 0) return 0;
        idx += needle.length();
        while (idx < (int)json.length() && json.charAt(idx) == ' ') idx++;
        return (uint32_t)json.substring(idx).toInt();
    }

    static bool extractJsonBool(const String &json, const char *key) {
        String needle = String("\"") + key + "\":";
        int idx = json.indexOf(needle);
        if (idx < 0) return false;
        idx += needle.length();
        while (idx < (int)json.length() && json.charAt(idx) == ' ') idx++;
        return json.substring(idx).startsWith("true");
    }

private:
    struct IncomingMsg {
        uint8_t *data;
        size_t len;
        uint32_t messageId;
        uint32_t displayDurationSec;
    };

    enum class MsgPostKind : uint8_t { Ack, Opened, Seen };

    struct PendingMsgPost {
        uint32_t messageId;
        MsgPostKind kind;
    };

    struct PendingAck {
        uint32_t messageId;
    };

    struct PendingNack {
        uint32_t messageId;
    };

    BacUserConfig *_config = nullptr;
    MessageReceivedFn _handler = nullptr;
    void *_handlerCtx = nullptr;
    ConfigCommandFn _configHandler = nullptr;
    void *_configHandlerCtx = nullptr;
    OtaOfferFn _otaOfferHandler = nullptr;
    void *_otaOfferHandlerCtx = nullptr;
    QueueHandle_t _queue = nullptr;
    QueueHandle_t _ackQueue = nullptr;
    QueueHandle_t _nackQueue = nullptr;
    QueueHandle_t _msgPostQueue = nullptr;
    TaskHandle_t _task = nullptr;
    bool _taskStarted = false;
    volatile bool _registerPending = false;
    volatile bool _registeredOk = false;
    volatile bool _otaHold = false;
    volatile bool _messageHold = false;
    uint32_t _lastHeartbeatMs = 0;
    mutable uint8_t _apiBaseIndex = 0;

    String apiBaseAt(uint8_t index) const {
        if (!_config) return BacUrlFailover::defaultHost(0);
        String bases[BacUrlFailover::kHostCount];
        bases[0] = _config->apiUrl.length() ? _config->apiUrl : BacUrlFailover::defaultHost(0);
        bases[1] = _config->apiUrlB1.length() ? _config->apiUrlB1 : BacUrlFailover::defaultHost(1);
        bases[2] = _config->apiUrlB2.length() ? _config->apiUrlB2 : BacUrlFailover::defaultHost(2);
        if (index >= BacUrlFailover::kHostCount) index = 0;
        return bases[index];
    }

    void noteApiFailure() {
        if (_apiBaseIndex + 1 < BacUrlFailover::kHostCount) {
            _apiBaseIndex++;
            return;
        }
        _apiBaseIndex = 0;
    }

    void noteApiSuccess() {
        if (!_config || _apiBaseIndex == 0) return;
        _config->apiUrl = apiBaseAt(_apiBaseIndex);
        _apiBaseIndex = 0;
        _config->save();
    }

    static void taskEntry(void *arg) {
        static_cast<BacCloudClient *>(arg)->taskLoop();
    }

    void drainMessagePosts() {
        PendingAck ack;
        while (_ackQueue && xQueueReceive(_ackQueue, &ack, 0) == pdTRUE) {
            sendAck(ack.messageId);
        }
        PendingNack nack;
        while (_nackQueue && xQueueReceive(_nackQueue, &nack, 0) == pdTRUE) {
            sendNack(nack.messageId);
        }
        PendingMsgPost post;
        while (_msgPostQueue && xQueueReceive(_msgPostQueue, &post, 0) == pdTRUE) {
            if (post.kind == MsgPostKind::Ack) sendAck(post.messageId);
            else if (post.kind == MsgPostKind::Opened) sendOpened(post.messageId);
            else if (post.kind == MsgPostKind::Seen) sendSeen(post.messageId);
        }
    }

    void taskLoop() {
        _ackQueue = xQueueCreate(4, sizeof(PendingAck));
        _nackQueue = xQueueCreate(4, sizeof(PendingNack));
        _msgPostQueue = xQueueCreate(8, sizeof(PendingMsgPost));
        for (;;) {
            if (!_config || WiFi.status() != WL_CONNECTED) {
                vTaskDelay(pdMS_TO_TICKS(500));
                continue;
            }
            if (_otaHold) {
                vTaskDelay(pdMS_TO_TICKS(200));
                continue;
            }
            drainMessagePosts();
            if (_messageHold) {
                vTaskDelay(pdMS_TO_TICKS(200));
                continue;
            }
            if (!_registeredOk) _registerPending = true;
            if (_registerPending) {
                if (registerDevice()) {
                    _registerPending = false;
                    _registeredOk = true;
                }
                vTaskDelay(pdMS_TO_TICKS(500));
                continue;
            }
            if (!_config->apiSecret.length()) {
                _registerPending = true;
                vTaskDelay(pdMS_TO_TICKS(1000));
                continue;
            }
            if (_lastHeartbeatMs == 0 || (millis() - _lastHeartbeatMs) >= HEARTBEAT_INTERVAL_MS) {
                sendHeartbeat();
                _lastHeartbeatMs = millis();
            }
            pollCommandsOnce();
            pollOnce();
            pollCommandsOnce();
        }
    }

    String apiBase() const {
        return apiBaseAt(_apiBaseIndex);
    }

    bool registerDevice() {
        if (!_config) return false;
        if (!_config->hasValidUuid()) {
            _config->ensureValidUuid();
            _config->save();
        }
        if (!_config->hasValidUuid()) return false;
        if (!_config->serialNumber.length()) {
            BAC_LOG("cloud", "register blocked: serial_number missing");
            return false;
        }
        String url = apiBase() + "/api/v1/devices/register";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(12000);
        if (!http.begin(client, url)) return false;
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Uuid", _config->uuid);
        if (_config->apiSecret.length()) http.addHeader("X-Device-Secret", _config->apiSecret);
        String body = "{\"device_name\":\"";
        body += jsonEscape(_config->deviceName);
        body += "\",\"serial_number\":\"";
        body += jsonEscape(_config->serialNumber);
        body += "\",\"display_name\":\"";
        body += jsonEscape(_config->labelName());
        body += "\",\"firmware_version\":\"";
        body += BAC_FW_VERSION;
        body += "\"";
        if (_config->region.length()) {
            body += ",\"region\":\"";
            body += jsonEscape(_config->region);
            body += "\"";
        }
        body += "}";
        int code = http.POST(body);
        String resp = http.getString();
        if (!BacUrlFailover::httpOk(code)) {
            noteApiFailure();
            http.end();
            url = apiBase() + "/api/v1/devices/register";
            if (!http.begin(client, url)) return false;
            http.addHeader("Content-Type", "application/json");
            http.addHeader("X-Device-Uuid", _config->uuid);
            if (_config->apiSecret.length()) http.addHeader("X-Device-Secret", _config->apiSecret);
            code = http.POST(body);
            resp = http.getString();
        }
        http.end();
        if (BacUrlFailover::httpOk(code)) noteApiSuccess();
        if (code != 200) {
            String err = extractJsonString(resp, "error");
            if (err.length()) BAC_LOGF("cloud", "register %d: %s", code, err.c_str());
            if (code == 400 && err == "invalid device secret" && _config->apiSecret.length()) {
                _config->apiSecret = "";
                _config->save();
            }
            return false;
        }
        String secret = extractJsonString(resp, "device_secret");
        if (secret.length()) {
            _config->apiSecret = secret;
            _config->save();
        }
        if (resp.indexOf("\"claimed\":") >= 0) {
            bool claimed = extractJsonBool(resp, "claimed");
            if (_config->claimed != claimed) {
                _config->claimed = claimed;
                _config->save();
            }
        }
        String otaPayload = extractJsonObject(resp, "firmware_update");
        if (otaPayload.length() && _otaOfferHandler && _config->claimed) {
            _otaOfferHandler(_otaOfferHandlerCtx, otaPayload.c_str());
        }
        return true;
    }

    void pollCommandsOnce() {
        if (!_configHandler) return;
        String url = apiBase() + "/api/v1/devices/commands/poll";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) {
            noteApiFailure();
            return;
        }
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.GET();
        if (code == 200) {
            noteApiSuccess();
            int len = http.getSize();
            if (len > (int)MAX_CMD_BODY) {
                BacDebug::eventf("cloud", "commands body too large %d", len);
                http.end();
                return;
            }
            String body = readBoundedBody(http, MAX_CMD_BODY);
            if (body.length() > 2) _configHandler(_configHandlerCtx, body.c_str());
        } else if (code < 0 || code >= 500) {
            noteApiFailure();
        }
        http.end();
    }

    static String readBoundedBody(HTTPClient &http, size_t maxLen) {
        WiFiClient *stream = http.getStreamPtr();
        if (!stream) return String();
        int len = http.getSize();
        if (len > (int)maxLen) return String();
        String out;
        out.reserve((len > 0 && (size_t)len <= maxLen) ? (size_t)len : 256);
        uint8_t buf[512];
        uint32_t started = millis();
        while (len < 0 || out.length() < (size_t)len) {
            size_t avail = stream->available();
            if (avail) {
                if (avail > sizeof(buf)) avail = sizeof(buf);
                int n = stream->readBytes(buf, avail);
                if (n <= 0) {
                    if (!http.connected()) break;
                    delay(1);
                    continue;
                }
                if (out.length() + (size_t)n > maxLen) return String();
                out.concat((const char *)buf, (unsigned int)n);
                started = millis();
                continue;
            }
            if (!http.connected()) break;
            if (millis() - started > 8000) break;
            delay(1);
        }
        return out;
    }

    static int resolvePollBodyLen(HTTPClient &http) {
        int len = http.getSize();
        if (len > 0) return len;
        String bytesHdr = http.header("X-Message-Bytes");
        if (bytesHdr.length()) {
            len = bytesHdr.toInt();
            if (len > 0) return len;
        }
        String clHdr = http.header("Content-Length");
        if (clHdr.length()) {
            len = clHdr.toInt();
            if (len > 0) return len;
        }
        return -1;
    }

    static size_t readPollBody(HTTPClient &http, uint8_t **outBuf) {
        if (!outBuf) return 0;
        int expected = resolvePollBodyLen(http);
        size_t cap = MAX_MSG;
        if (expected > 0 && (size_t)expected < cap) cap = (size_t)expected;
        uint8_t *buf = allocPollBuffer(cap);
        if (!buf) return 0;
        PollBodyStream sink;
        sink.reset(buf, cap);
        int written = http.writeToStream(&sink);
        size_t readLen = sink.length();
        if (written > 0 && (size_t)written > readLen) readLen = (size_t)written;
        if (readLen == 0) {
            heap_caps_free(buf);
            return 0;
        }
        *outBuf = buf;
        return readLen;
    }

    static size_t normalizeBacmBuffer(uint8_t *buf, size_t len) {
        size_t off = BacMessageStore::findBacmOffset(buf, len);
        if (off == SIZE_MAX) return 0;
        if (off > 0) {
            len -= off;
            memmove(buf, buf + off, len);
        }
        size_t payloadSize = BacMessageStore::binaryPayloadSize(buf, len);
        if (payloadSize == 0 || payloadSize > len) return 0;
        return payloadSize;
    }

    static uint8_t *allocPollBuffer(size_t len) {
        uint8_t *buf = (uint8_t *)heap_caps_malloc(len, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!buf) buf = (uint8_t *)heap_caps_malloc(len, MALLOC_CAP_8BIT);
        return buf;
    }

    void pollOnce() {
        String url = apiBase() + "/api/v1/devices/poll?timeout=" + String(POLL_TIMEOUT_SEC);
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(HTTP_TIMEOUT_MS);
        if (!http.begin(client, url)) {
            noteApiFailure();
            return;
        }
        const char *pollHeaders[] = {"X-Message-Id", "X-Message-Bytes", "Content-Length", "X-Display-Duration-Sec"};
        http.collectHeaders(pollHeaders, 4);
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.GET();
        if (code == 401) {
            _config->apiSecret = "";
            _config->save();
            _registerPending = true;
            _registeredOk = false;
            http.end();
            return;
        }
        if (code < 0 || code >= 500) {
            noteApiFailure();
            http.end();
            return;
        }
        noteApiSuccess();
        if (code == 200) {
            String msgIdHdr = http.header("X-Message-Id");
            uint32_t msgId = msgIdHdr.length() ? (uint32_t)msgIdHdr.toInt() : 0;
            if (!msgId) BAC_LOG("cloud", "poll missing X-Message-Id");
            uint8_t *buf = nullptr;
            size_t readLen = readPollBody(http, &buf);
            if (readLen == 0 || !buf) {
                BacDebug::eventf("cloud", "poll nack %u read empty", msgId);
                if (msgId) sendNack(msgId);
                http.end();
                return;
            }
            size_t payloadSize = normalizeBacmBuffer(buf, readLen);
            if (payloadSize == 0) {
                BacDebug::eventf("cloud", "poll nack %u bad bacm %u b0=%02x%02x%02x%02x",
                    msgId, (unsigned)readLen, buf[0], buf[1], buf[2], buf[3]);
                if (msgId) sendNack(msgId);
                heap_caps_free(buf);
                http.end();
                return;
            }
            String durHdr = http.header("X-Display-Duration-Sec");
            uint32_t displaySec = durHdr.length() ? (uint32_t)durHdr.toInt() : 0;
            IncomingMsg msg = {buf, payloadSize, msgId, displaySec};
            if (xQueueSend(_queue, &msg, pdMS_TO_TICKS(100)) != pdTRUE) {
                BacDebug::eventf("cloud", "poll nack %u queue full", msgId);
                if (msgId) sendNack(msgId);
                heap_caps_free(buf);
            }
        }
        http.end();
    }

    void sendNack(uint32_t messageId) {
        String url = apiBase() + "/api/v1/devices/messages/" + String(messageId) + "/nack";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return;
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        http.POST((uint8_t *)"{}", 2);
        http.end();
    }

    void sendAck(uint32_t messageId) {
        postDeviceMessage(messageId, "ack");
    }

    void sendOpened(uint32_t messageId) {
        postDeviceMessage(messageId, "opened");
    }

    void sendSeen(uint32_t messageId) {
        postDeviceMessage(messageId, "seen");
    }

    void postDeviceMessage(uint32_t messageId, const char *action) {
        String url = apiBase() + "/api/v1/devices/messages/" + String(messageId) + "/" + action;
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return;
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.POST((uint8_t *)"{}", 2);
        if (code < 200 || code > 299) {
            BacDebug::eventf("cloud", "%s %u failed http %d", action, messageId, code);
        }
        http.end();
    }

    void sendHeartbeat() {
        if (!_config || !_config->apiSecret.length()) return;
        String url = apiBase() + "/api/v1/devices/heartbeat";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) {
            noteApiFailure();
            return;
        }
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        uint8_t mac[6];
        WiFi.macAddress(mac);
        char macBuf[18];
        snprintf(macBuf, sizeof(macBuf), "%02X:%02X:%02X:%02X:%02X:%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        String body = "{\"firmware_version\":\"";
        body += BAC_FW_VERSION;
        body += "\",\"rssi\":";
        body += String(WiFi.RSSI());
        body += ",\"free_heap\":";
        body += String((uint32_t)ESP.getFreeHeap());
        body += ",\"uptime_s\":";
        body += String((uint32_t)(millis() / 1000));
        body += ",\"ip\":\"";
        body += jsonEscape(WiFi.localIP().toString());
        body += "\",\"mac\":\"";
        body += macBuf;
        body += "\"}";
        int code = http.POST(body);
        String resp = http.getString();
        if (code >= 200 && code <= 299) {
            noteApiSuccess();
            String otaPayload = extractJsonObject(resp, "firmware_update");
            if (otaPayload.length() && _otaOfferHandler && _config->claimed) {
                _otaOfferHandler(_otaOfferHandlerCtx, otaPayload.c_str());
            }
        } else {
            if (code < 0 || code >= 500) noteApiFailure();
            BacDebug::eventf("cloud", "heartbeat failed http %d", code);
        }
        http.end();
    }

    static String jsonEscape(const String &s) {
        String out;
        out.reserve(s.length() + 8);
        for (unsigned int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') out += '\\';
            out += c;
        }
        return out;
    }
};

#else

class BacCloudClient {
public:
    typedef void (*MessageReceivedFn)(void *, uint8_t *, size_t, uint32_t);
    void begin(BacUserConfig *, MessageReceivedFn, void *) {}
    void onWifiConnected() {}
    void tickIdle() {}
    void ackMessage(uint32_t) {}
    void nackMessage(uint32_t) {}
    void openedMessage(uint32_t) {}
    void seenMessage(uint32_t) {}
    void setMessageHold(bool) {}
    void setConfigCommandHandler(ConfigCommandFn, void *) {}
    void setOtaOfferHandler(OtaOfferFn, void *) {}
    void setOtaHold(bool) {}
    bool ackCommand(uint32_t) { return false; }
    bool failCommand(uint32_t) { return false; }
    bool deregisterDevice() { return false; }
};

#endif
