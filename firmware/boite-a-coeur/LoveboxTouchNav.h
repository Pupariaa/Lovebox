#pragma once

#if defined(ESP32) && SOC_TOUCH_SENSOR_SUPPORTED

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <string.h>
#include "Projet.h"
#include "BacDebug.h"

class LoveboxTouchNav {
public:
    void begin(uint8_t pin) {
        _pin = pin;
        _wasPressed = false;
        _longFired = false;
        _pressStartMs = 0;
        _lostEnteredMs = 0;
        _ready = false;
    }

    void setEnabled(bool on) {
        _ready = on;
        if (!on) {
            _wasPressed = false;
            _longFired = false;
        }
    }

    void poll(lucarne::UI &ui, uint32_t touchVal, bool haveTouchVal) {
        if (!_ready) return;

        uint32_t v = haveTouchVal ? touchVal : touchRead(_pin);
        bool pressed;
        if (_wasPressed) {
            pressed = v > _touchReleaseMax;
        } else {
            pressed = v >= _touchActiveMin;
        }

        lucarne::Screen *cur = ui.current();
        uint32_t now = millis();

        if (onScreen(cur, "lost_connection")) {
            if (now - _lostEnteredMs < _lostCooldownMs) {
                _wasPressed = pressed;
                return;
            }
            if (pressed && !_wasPressed) {
                ui.navigate(&projet::screen_scr_mqxp1ppa3, lucarne::Transition::None);
                BAC_LOG("ui", "screen new_message");
                radioYield();
            }
            _wasPressed = pressed;
            return;
        }

        if (pressed) {
            if (!_wasPressed) {
                _pressStartMs = now;
                _longFired = false;
            } else if (!_longFired && (now - _pressStartMs) >= _holdMs) {
                _longFired = true;
                ui.navigate(&projet::screen_scr_mqwqhtj72, lucarne::Transition::None);
                _lostEnteredMs = now;
                BAC_LOG("ui", "screen lost_connection");
                radioYield();
            }
        } else if (_wasPressed && !_longFired) {
            uint32_t dur = now - _pressStartMs;
            if (dur >= _tapMinMs && dur < _holdMs && onScreen(cur, "new_message")) {
                ui.navigate(&projet::screen_scr_mqzdddx81, lucarne::Transition::None);
                BAC_LOG("ui", "screen message_opened");
                radioYield();
            }
        }

        _wasPressed = pressed;
    }

    void setTouchActiveMin(uint32_t v) { _touchActiveMin = v; }
    void setTouchReleaseMax(uint32_t v) { _touchReleaseMax = v; }
    void setHoldMs(uint32_t ms) { _holdMs = ms; }
    void setLostCooldownMs(uint32_t ms) { _lostCooldownMs = ms; }

private:
    static bool onScreen(lucarne::Screen *screen, const char *name) {
        return screen && screen->name() && strcmp(screen->name(), name) == 0;
    }

    static void radioYield() {
        vTaskDelay(1);
        yield();
    }

    uint8_t _pin = 1;
    uint32_t _touchActiveMin = 23500;
    uint32_t _touchReleaseMax = 22500;
    uint32_t _holdMs = 5000;
    uint32_t _lostCooldownMs = 3000;
    uint32_t _tapMinMs = 40;
    bool _wasPressed = false;
    bool _longFired = false;
    bool _ready = false;
    uint32_t _pressStartMs = 0;
    uint32_t _lostEnteredMs = 0;
};

#else

#include "Projet.h"

class LoveboxTouchNav {
public:
    void begin(uint8_t) {}
    void setEnabled(bool) {}
    void poll(lucarne::UI &) {}
    void poll(lucarne::UI &, uint32_t, bool) {}
    void setTouchActiveMin(uint32_t) {}
    void setTouchReleaseMax(uint32_t) {}
    void setHoldMs(uint32_t) {}
    void setLostCooldownMs(uint32_t) {}
};

#endif
