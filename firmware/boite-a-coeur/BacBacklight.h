#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include "Projet_setup.h"

struct BacBacklight {
    void begin() { applyLevel(_level); }

    void applyLevel(uint8_t level) {
        _level = level > 100 ? 100 : level;
        lucarne::DisplayPins pins = projet::displayPins();
        if (pins.bl < 0) return;
        lucarne::DisplayOptions opt = projet::displayOptions();
        bool on = _level > 0;
        bool levelOut = on ^ opt.blActiveLow;
        digitalWrite(pins.bl, levelOut ? HIGH : LOW);
    }

    uint8_t level() const { return _level; }

    void on() { applyLevel(_level > 0 ? _level : 100); }
    void off() { applyLevel(0); }

private:
    uint8_t _level = 100;
};

#else

struct BacBacklight {
    void begin() {}
    void applyLevel(uint8_t) {}
    uint8_t level() const { return 100; }
    void on() {}
    void off() {}
};

#endif
