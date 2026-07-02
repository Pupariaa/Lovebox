#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include "BacMessageStore.h"
#include <Lucarne.h>

class BacMessageRenderer {
public:
    void begin(BacMessageStore *store) { _store = store; }

    void resetAnim() {
        _animFrame = 0;
        _animLastMs = 0;
    }

    void draw(lucarne::Display &disp, uint32_t nowMs) {
        if (!_store || !_store->hasMessage()) return;
        uint16_t sw = _store->screenW();
        uint16_t sh = _store->screenH();
        const uint16_t *bg = _store->background();
        if (bg) {
            disp.writeBufferRect(0, 0, sw, sh, bg);
        }
        for (uint8_t i = 0; i < _store->layerCount(); i++) {
            const BacMessageStore::Layer *L = _store->layer(i);
            if (!L || !L->data) continue;
            if (L->type == BacMessageStore::LAYER_STATIC) {
                const uint16_t *px = (const uint16_t *)L->data;
                disp.writeBufferRect(L->x, L->y, L->w, L->h, px);
            } else if (L->type == BacMessageStore::LAYER_ANIM) {
                uint32_t frameBytes = (uint32_t)L->w * L->h * 2;
                if (frameBytes == 0 || L->frameCount == 0) continue;
                uint8_t fps = L->fps ? L->fps : 12;
                uint32_t interval = 1000 / fps;
                if (_animLastMs == 0) _animLastMs = nowMs;
                if (nowMs - _animLastMs >= interval) {
                    _animLastMs = nowMs;
                    _animFrame++;
                    if (_animFrame >= L->frameCount) _animFrame = 0;
                }
                uint32_t off = (uint32_t)_animFrame * frameBytes;
                if (off + frameBytes > L->dataSize) continue;
                const uint16_t *px = (const uint16_t *)(L->data + off);
                disp.writeBufferRect(L->x, L->y, L->w, L->h, px);
            }
        }
    }

private:
    BacMessageStore *_store = nullptr;
    uint16_t _animFrame = 0;
    uint32_t _animLastMs = 0;
};

#else

class BacMessageRenderer {
public:
    void begin(BacMessageStore *) {}
    void resetAnim() {}
    void draw(lucarne::Display &, uint32_t) {}
};

#endif
