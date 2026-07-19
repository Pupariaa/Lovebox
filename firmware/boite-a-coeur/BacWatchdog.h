#pragma once

#if defined(ESP32)

#include <esp_task_wdt.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

struct BacWatchdog {
    static void subscribe() {
        esp_task_wdt_add(nullptr);
    }

    static void unsubscribe() {
        esp_task_wdt_delete(nullptr);
    }

    static void feed() {
        esp_task_wdt_reset();
    }
};

#else

struct BacWatchdog {
    static void subscribe() {}
    static void unsubscribe() {}
    static void feed() {}
};

#endif
