#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <esp_freertos_hooks.h>
#include <esp_heap_caps.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "Lucarne.h"

static DRAM_ATTR volatile uint32_t loveboxIdleCount0 = 0;
static DRAM_ATTR volatile uint32_t loveboxIdleCount1 = 0;

static bool IRAM_ATTR loveboxIdleHook0() {
    loveboxIdleCount0++;
    return false;
}

static bool IRAM_ATTR loveboxIdleHook1() {
    loveboxIdleCount1++;
    return false;
}

class LoveboxMonitor {
public:
    static const int16_t BAR_H = 54;

    void begin() {
        if (_ready) return;
        _lastIdle0 = loveboxIdleCount0;
        _lastIdle1 = loveboxIdleCount1;
        _peakIdle0 = 1;
        _peakIdle1 = 1;
        _lastSampleMs = millis();
        _lastFpsMs = _lastSampleMs;
        _lastTouchSerialMs = _lastSampleMs;
        _lastOverlayFlushMs = _lastSampleMs;
        _loopCount = 0;
        _psramMinFree = SIZE_MAX;
        esp_register_freertos_idle_hook_for_cpu(&loveboxIdleHook0, 0);
        esp_register_freertos_idle_hook_for_cpu(&loveboxIdleHook1, 1);
        _ready = true;
    }

    void setTouchPin(uint8_t pin) {
        _touchPin = pin;
    }

    void setTouchSerialMs(uint32_t ms) {
        if (ms >= 50) _touchSerialMs = ms;
    }

    void tick(lucarne::Display &display, bool drawOverlay, bool serialLog, uint32_t touchSample = UINT32_MAX) {
        if (!_ready) return;

        _loopCount++;
        uint32_t now = millis();
        if (touchSample != UINT32_MAX) {
            _touchVal = touchSample;
        } else {
            sampleTouch();
        }

        bool sample = (now - _lastSampleMs) >= _intervalMs;
        if (sample) {
            uint32_t fpsElapsed = now - _lastFpsMs;
            if (fpsElapsed < 1) fpsElapsed = 1;

            uint32_t d0 = loveboxIdleCount0 - _lastIdle0;
            uint32_t d1 = loveboxIdleCount1 - _lastIdle1;
            _lastIdle0 = loveboxIdleCount0;
            _lastIdle1 = loveboxIdleCount1;
            _lastSampleMs = now;

            updatePeak(d0, _peakIdle0);
            updatePeak(d1, _peakIdle1);

            _psramTotal = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
            _psramFree = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
            _psramUsed = _psramTotal > _psramFree ? _psramTotal - _psramFree : 0;
            if (_psramFree < _psramMinFree) _psramMinFree = _psramFree;

            _intFree = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
            _intLargest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);

            _cpu0 = cpuPercent(d0, _peakIdle0);
            _cpu1 = cpuPercent(d1, _peakIdle1);

            _fps = (float)_loopCount * 1000.0f / (float)fpsElapsed;
            _loopCount = 0;
            _lastFpsMs = now;

            if (serialLog) {
                Serial.print(F("MON PSRAM "));
                Serial.print(_psramUsed / 1024);
                Serial.print(F("/"));
                Serial.print(_psramTotal / 1024);
                Serial.print(F(" KB free="));
                Serial.print(_psramFree / 1024);
                Serial.print(F(" min="));
                Serial.print(_psramMinFree / 1024);
                Serial.print(F(" KB | INT free="));
                Serial.print(_intFree / 1024);
                Serial.print(F(" KB largest="));
                Serial.print(_intLargest / 1024);
                Serial.print(F(" KB | CPU0="));
                Serial.print(_cpu0, 1);
                Serial.print(F("% CPU1="));
                Serial.print(_cpu1, 1);
                Serial.print(F("% | FPS="));
                Serial.print(_fps, 1);
                Serial.println();
            }
        }

        if (drawOverlay) {
            bool flushOverlay = (now - _lastOverlayFlushMs) >= _overlayFlushMs;
            if (flushOverlay) {
                drawBar(display);
                display.display(0, 0, display.width(), BAR_H);
                _lastOverlayFlushMs = now;
            }
        }
    }

    void setIntervalMs(uint32_t ms) {
        if (ms >= 200) _intervalMs = ms;
    }

    void setOverlayFlushMs(uint32_t ms) {
        if (ms >= 50) _overlayFlushMs = ms;
    }

    uint32_t touchValue() const { return _touchVal; }

private:
    void sampleTouch() {
#if SOC_TOUCH_SENSOR_SUPPORTED
        if (_touchPin != 255) {
            _touchVal = touchRead(_touchPin);
        }
#else
        (void)_touchPin;
        _touchVal = 0;
#endif
    }

    static void updatePeak(uint32_t delta, uint32_t &peak) {
        if (delta > peak) {
            peak = delta;
            return;
        }
        uint32_t decayed = peak - (peak / 32);
        if (decayed < 1) decayed = 1;
        if (delta > decayed) peak = delta;
        else peak = decayed;
    }

    static float cpuPercent(uint32_t delta, uint32_t peak) {
        if (peak == 0) return 0.0f;
        float idle = (float)delta / (float)peak;
        if (idle > 1.0f) idle = 1.0f;
        return (1.0f - idle) * 100.0f;
    }

    void drawBar(lucarne::Display &display) {
        const int16_t w = display.width();
        const int16_t y0 = 0;
        char line[56];

        display.fillRect(0, y0, w, BAR_H, lucarne::color565(0, 0, 0));
        display.setTextSize(1);
        display.setTextColor(lucarne::color565(140, 220, 140));

        display.setCursor(2, (int16_t)(y0 + 2));
        snprintf(line, sizeof(line), "PSRAM %lu/%lu free %lu min %lu",
                 (unsigned long)(_psramUsed / 1024),
                 (unsigned long)(_psramTotal / 1024),
                 (unsigned long)(_psramFree / 1024),
                 (unsigned long)(_psramMinFree / 1024));
        display.print(line);

        display.setCursor(2, (int16_t)(y0 + 12));
        snprintf(line, sizeof(line), "INT free %lu KB  blk %lu",
                 (unsigned long)(_intFree / 1024),
                 (unsigned long)(_intLargest / 1024));
        display.print(line);

        display.setCursor(2, (int16_t)(y0 + 22));
        snprintf(line, sizeof(line), "CPU0 %.0f%%  CPU1 %.0f%%",
                 (double)_cpu0, (double)_cpu1);
        display.print(line);

        display.setCursor(2, (int16_t)(y0 + 32));
        snprintf(line, sizeof(line), "FPS %.0f",
                 (double)_fps);
        display.print(line);

        if (_touchPin != 255) {
            display.setCursor(2, (int16_t)(y0 + 42));
            snprintf(line, sizeof(line), "TCH pin %u  val %lu",
                     (unsigned)_touchPin, (unsigned long)_touchVal);
            display.print(line);
        }
    }

    uint8_t _touchPin = 255;
    uint32_t _touchVal = 0;
    uint32_t _lastTouchSerialMs = 0;
    uint32_t _touchSerialMs = 100;
    uint32_t _overlayFlushMs = 150;
    uint32_t _lastOverlayFlushMs = 0;
    uint32_t _lastIdle0 = 0;
    uint32_t _lastIdle1 = 0;
    uint32_t _peakIdle0 = 1;
    uint32_t _peakIdle1 = 1;
    uint32_t _lastSampleMs = 0;
    uint32_t _lastFpsMs = 0;
    uint32_t _loopCount = 0;
    uint32_t _intervalMs = 1000;
    size_t _psramMinFree = SIZE_MAX;
    uint32_t _psramTotal = 0;
    uint32_t _psramFree = 0;
    uint32_t _psramUsed = 0;
    uint32_t _intFree = 0;
    uint32_t _intLargest = 0;
    float _cpu0 = 0.0f;
    float _cpu1 = 0.0f;
    float _fps = 0.0f;
    bool _ready = false;
};

#endif
