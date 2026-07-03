#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include "BacUserConfig.h"
#include "BacFirmware.h"
#include "BacDebug.h"
#include "BacTls.h"

class BacCloudClient {
public:
    static const uint32_t POLL_TIMEOUT_SEC = 25;
    static const uint32_t HTTP_TIMEOUT_MS = 32000;
    static const size_t MAX_MSG = 2097152;

    typedef void (*MessageReceivedFn)(void *ctx, uint8_t *data, size_t len, uint32_t messageId);
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
            if (msg.data && msg.len > 0) _handler(_handlerCtx, msg.data, msg.len, msg.messageId);
            else if (msg.data) free(msg.data);
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
    TaskHandle_t _task = nullptr;
    bool _taskStarted = false;
    volatile bool _registerPending = false;
    volatile bool _registeredOk = false;
    volatile bool _otaHold = false;

    static void taskEntry(void *arg) {
        static_cast<BacCloudClient *>(arg)->taskLoop();
    }

    void taskLoop() {
        _ackQueue = xQueueCreate(4, sizeof(PendingAck));
        _nackQueue = xQueueCreate(4, sizeof(PendingNack));
        for (;;) {
            if (!_config || WiFi.status() != WL_CONNECTED) {
                vTaskDelay(pdMS_TO_TICKS(500));
                continue;
            }
            if (_otaHold) {
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
            PendingAck ack;
            while (_ackQueue && xQueueReceive(_ackQueue, &ack, 0) == pdTRUE) {
                sendAck(ack.messageId);
            }
            PendingNack nack;
            while (_nackQueue && xQueueReceive(_nackQueue, &nack, 0) == pdTRUE) {
                sendNack(nack.messageId);
            }
            pollCommandsOnce();
            pollOnce();
        }
    }

    String apiBase() const {
        if (_config && _config->apiUrl.length()) return _config->apiUrl;
        return "https://boite-a-coeur.techalchemy.fr";
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
        http.end();
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
        if (!http.begin(client, url)) return;
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        int code = http.GET();
        if (code == 200) {
            String body = http.getString();
            if (body.length() > 2) _configHandler(_configHandlerCtx, body.c_str());
        }
        http.end();
    }

    void pollOnce() {
        String url = apiBase() + "/api/v1/devices/poll?timeout=" + String(POLL_TIMEOUT_SEC);
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(HTTP_TIMEOUT_MS);
        if (!http.begin(client, url)) return;
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
        if (code == 200) {
            String msgIdHdr = http.header("X-Message-Id");
            uint32_t msgId = msgIdHdr.length() ? (uint32_t)msgIdHdr.toInt() : 0;
            int len = http.getSize();
            if (len > 0 && len <= (int)MAX_MSG) {
                uint8_t *buf = (uint8_t *)malloc((size_t)len);
                if (buf) {
                    WiFiClient *stream = http.getStreamPtr();
                    size_t read = stream->readBytes(buf, (size_t)len);
                    if (read > 0) {
                        IncomingMsg msg = {buf, read, msgId};
                        if (xQueueSend(_queue, &msg, pdMS_TO_TICKS(100)) != pdTRUE) free(buf);
                    } else free(buf);
                }
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
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        http.POST((uint8_t *)nullptr, 0);
        http.end();
    }

    void sendAck(uint32_t messageId) {
        String url = apiBase() + "/api/v1/devices/messages/" + String(messageId) + "/ack";
        WiFiClientSecure client;
        BacTls::configure(client);
        HTTPClient http;
        http.setTimeout(8000);
        if (!http.begin(client, url)) return;
        http.addHeader("X-Device-Uuid", _config->uuid);
        http.addHeader("X-Device-Secret", _config->apiSecret);
        http.POST((uint8_t *)nullptr, 0);
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
    void setConfigCommandHandler(ConfigCommandFn, void *) {}
    void setOtaOfferHandler(OtaOfferFn, void *) {}
    void setOtaHold(bool) {}
    bool ackCommand(uint32_t) { return false; }
    bool failCommand(uint32_t) { return false; }
};

#endif
