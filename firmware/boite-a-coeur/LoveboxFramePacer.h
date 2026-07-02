#pragma once

#include <Arduino.h>

class LoveboxFramePacer {
public:
    void begin(uint8_t fps = 45) {
        setFps(fps);
        _lastMs = millis();
    }

    void setFps(uint8_t fps) {
        if (fps < 1) fps = 1;
        if (fps > 120) fps = 120;
        _frameMs = (uint32_t)(1000 / fps);
        if (_frameMs < 1) _frameMs = 1;
    }

    void wait() {
        uint32_t now = millis();
        uint32_t elapsed = now - _lastMs;
        if (elapsed < _frameMs) {
            delay(_frameMs - elapsed);
        }
        _lastMs = millis();
    }

private:
    uint32_t _frameMs = 22;
    uint32_t _lastMs = 0;
};
