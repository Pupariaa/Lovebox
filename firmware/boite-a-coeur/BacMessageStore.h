#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <string.h>

class BacMessageStore {
public:
    static const uint32_t MAX_MESSAGE_BYTES = 3145728;
    static const uint8_t LAYER_STATIC = 0;
    static const uint8_t LAYER_ANIM = 1;

    struct Layer {
        uint8_t type;
        uint8_t fps;
        uint16_t x;
        uint16_t y;
        uint16_t w;
        uint16_t h;
        uint16_t frameCount;
        uint32_t dataSize;
        uint8_t *data;
        bool owned = false;
    };

    bool hasMessage() const { return _ready; }
    uint16_t screenW() const { return _w; }
    uint16_t screenH() const { return _h; }
    const uint16_t *background() const { return _bg; }
    uint8_t layerCount() const { return _layerCount; }
    const Layer *layer(uint8_t i) const { return i < _layerCount ? &_layers[i] : nullptr; }

    void clear() {
        freeAll();
        _ready = false;
    }

    static size_t binaryPayloadSize(const uint8_t *data, size_t len) {
        if (!data || len < 12) return 0;
        if (memcmp(data, "BACM", 4) != 0) return 0;
        uint16_t version = (uint16_t)(data[4] | (data[5] << 8));
        if (version != 1) return 0;
        uint16_t w = (uint16_t)(data[6] | (data[7] << 8));
        uint16_t h = (uint16_t)(data[8] | (data[9] << 8));
        uint8_t layerCount = data[10];
        if (w == 0 || h == 0 || layerCount > 8) return 0;
        size_t off = 12 + (size_t)w * h * 2;
        if (off > len) return 0;
        for (uint8_t i = 0; i < layerCount; i++) {
            if (off + 16 > len) return 0;
            uint32_t dataSize = (uint32_t)data[off + 12] | ((uint32_t)data[off + 13] << 8) |
                                ((uint32_t)data[off + 14] << 16) | ((uint32_t)data[off + 15] << 24);
            if (dataSize == 0) return 0;
            off += 16 + dataSize;
            if (off > len) return 0;
        }
        return off;
    }

    static size_t findBacmOffset(const uint8_t *data, size_t len) {
        if (!data || len < 12) return SIZE_MAX;
        size_t scanMax = len - 12;
        if (scanMax > 512) scanMax = 512;
        for (size_t i = 0; i <= scanMax; i++) {
            if (memcmp(data + i, "BACM", 4) != 0) continue;
            if (binaryPayloadSize(data + i, len - i) > 0) return i;
        }
        return SIZE_MAX;
    }

    bool loadFromBinary(const uint8_t *data, size_t len) {
        return loadFromBinary(data, len, false);
    }

    bool loadFromBinary(const uint8_t *data, size_t len, bool takeOwnership) {
        clear();
        size_t payloadSize = binaryPayloadSize(data, len);
        if (payloadSize == 0) return false;
        len = payloadSize;
        if (takeOwnership) _ownedBuf = (uint8_t *)data;
        if (!data || len < 12) {
            clear();
            return false;
        }
        _w = (uint16_t)(data[6] | (data[7] << 8));
        _h = (uint16_t)(data[8] | (data[9] << 8));
        _layerCount = data[10];
        size_t bgBytes = (size_t)_w * _h * 2;
        size_t off = 12;
        if (off + bgBytes > len) {
            clear();
            return false;
        }
        if (takeOwnership) {
            _bg = (uint16_t *)(_ownedBuf + off);
        } else {
            _bg = allocRgb565(bgBytes);
            if (!_bg) return false;
            memcpy(_bg, data + off, bgBytes);
        }
        off += bgBytes;
        for (uint8_t i = 0; i < _layerCount; i++) {
            if (off + 16 > len) {
                clear();
                return false;
            }
            Layer &L = _layers[i];
            L.type = data[off];
            L.fps = data[off + 1];
            L.x = (uint16_t)(data[off + 2] | (data[off + 3] << 8));
            L.y = (uint16_t)(data[off + 4] | (data[off + 5] << 8));
            L.w = (uint16_t)(data[off + 6] | (data[off + 7] << 8));
            L.h = (uint16_t)(data[off + 8] | (data[off + 9] << 8));
            L.frameCount = (uint16_t)(data[off + 10] | (data[off + 11] << 8));
            L.dataSize = (uint32_t)data[off + 12] | ((uint32_t)data[off + 13] << 8) |
                         ((uint32_t)data[off + 14] << 16) | ((uint32_t)data[off + 15] << 24);
            off += 16;
            if (L.w == 0 || L.h == 0 || L.frameCount == 0 || L.dataSize == 0) {
                clear();
                return false;
            }
            if (off + L.dataSize > len) {
                clear();
                return false;
            }
            if (takeOwnership) {
                L.data = _ownedBuf + off;
                L.owned = false;
            } else {
                L.data = (uint8_t *)allocBytes(L.dataSize);
                L.owned = true;
                if (!L.data) {
                    clear();
                    return false;
                }
                memcpy(L.data, data + off, L.dataSize);
            }
            off += L.dataSize;
        }
        _ready = true;
        return true;
    }

private:
    uint16_t *allocRgb565(size_t bytes) {
        void *p = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!p) p = heap_caps_malloc(bytes, MALLOC_CAP_8BIT);
        return (uint16_t *)p;
    }

    void *allocBytes(size_t bytes) {
        void *p = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!p) p = heap_caps_malloc(bytes, MALLOC_CAP_8BIT);
        return p;
    }

    void freeAll() {
        if (_ownedBuf) {
            heap_caps_free(_ownedBuf);
            _ownedBuf = nullptr;
            _bg = nullptr;
        } else if (_bg) {
            heap_caps_free(_bg);
            _bg = nullptr;
        }
        for (uint8_t i = 0; i < _layerCount; i++) {
            if (_layers[i].data && _layers[i].owned) {
                heap_caps_free(_layers[i].data);
            }
            _layers[i].data = nullptr;
            _layers[i].owned = false;
        }
        _layerCount = 0;
        _w = 0;
        _h = 0;
    }

    bool _ready = false;
    uint16_t _w = 0;
    uint16_t _h = 0;
    uint8_t _layerCount = 0;
    uint16_t *_bg = nullptr;
    uint8_t *_ownedBuf = nullptr;
    Layer _layers[8];
};

#else

class BacMessageStore {
public:
    bool hasMessage() const { return false; }
    void clear() {}
    bool loadFromBinary(const uint8_t *, size_t) { return false; }
};

#endif
