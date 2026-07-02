#pragma once

#if defined(ESP32)

#include <Arduino.h>

class BacTouch {
public:
    void begin(uint8_t pin) {
        _pin = pin;
    }

    uint32_t read() const {
        uint32_t a = touchRead(_pin);
        uint32_t b = touchRead(_pin);
        uint32_t c = touchRead(_pin);
        if (a > b) { uint32_t t = a; a = b; b = t; }
        if (b > c) { uint32_t t = b; b = c; c = t; }
        if (a > b) { uint32_t t = a; a = b; b = t; }
        return b;
    }

private:
    uint8_t _pin = 1;
};

#else

class BacTouch {
public:
    void begin(uint8_t) {}
    uint32_t read() const { return 0; }
};

#endif
