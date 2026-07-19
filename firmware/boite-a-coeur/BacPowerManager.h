#pragma once

#if defined(ESP32)

#include <Arduino.h>

struct BacPowerManager {
    static constexpr uint32_t kIdleRefreshMs = 30000;

    uint32_t lastActivityMs = 0;
    bool displaySleeping = false;
    uint32_t lastIdleRefreshMs = 0;
    bool idleRefreshDue = false;

    void resetActivity() {
        lastActivityMs = millis();
        displaySleeping = false;
        idleRefreshDue = false;
    }

    void tick(uint32_t sleepTimeoutSec, bool displaySleepEnabled, bool allowSleep) {
        if (!allowSleep) {
            displaySleeping = false;
            idleRefreshDue = false;
            return;
        }
        uint32_t timeoutMs = (sleepTimeoutSec > 0 ? sleepTimeoutSec : 30) * 1000UL;
        if (millis() - lastActivityMs < timeoutMs) return;
        if (displaySleepEnabled) {
            displaySleeping = true;
            idleRefreshDue = false;
            return;
        }
        if (millis() - lastIdleRefreshMs >= kIdleRefreshMs) {
            idleRefreshDue = true;
            lastIdleRefreshMs = millis();
        }
    }

    bool shouldRenderUi() const { return true; }

    uint8_t targetFps(bool activeMessage) const {
        if (activeMessage) return 45;
        if (displaySleeping) return 1;
        return 8;
    }
};

#else

struct BacPowerManager {
    void resetActivity() {}
    void tick(uint32_t, bool, bool) {}
    bool shouldRenderUi() const { return true; }
    uint8_t targetFps(bool) const { return 45; }
};

#endif
