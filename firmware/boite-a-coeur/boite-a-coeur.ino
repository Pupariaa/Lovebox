#include <WiFi.h>
#include "Projet.h"
#include "Projet_setup.h"

#if defined(ESP32)
#include "LoveboxFramePacer.h"
#include "BacScreenCache.h"
#include "BacApp.h"
#include "BacDebug.h"
#include "BacSysInfo.h"
#include "BacSerialConsole.h"
#include "BacTouch.h"
#include <esp_task_wdt.h>
#endif

using namespace lucarne;

static const uint8_t TARGET_FPS = 45;
static const uint8_t TOUCH_PIN = 1;

ST7789 display;
UI ui(display);

static BacApp app;
static BacScreenCache screenCache;
static BacTouch touch;
static LoveboxFramePacer framePacer;
static BacSerialConsole serialConsole;

void setup() {
    Serial.begin(115200);

#if defined(ESP32)
    esp_task_wdt_config_t wdt = {};
    wdt.timeout_ms = 60000;
    wdt.trigger_panic = true;
    esp_task_wdt_reconfigure(&wdt);
    touch.begin(TOUCH_PIN);
    serialConsole.begin();
#endif

    projet::initSpiBus();

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;

    if (!display.begin(projet::displayPins(), projet::displayOptions(), buffer, &SPI)) {
        BacDebug::reply("display init failed");
        return;
    }

    projet::build(ui);
    ui.setTransition(Transition::Fade, 200);

    if (!projet::initStorage()) {
        BacDebug::reply("warning: volume assets unavailable");
    }

    ui.begin();

    screenCache.begin(ui, &projet::screen_scr_mqxozray1);
    app.begin(ui, screenCache);
    app.onCacheReady();
    projet::attachInput(ui);
    framePacer.begin(TARGET_FPS);
}

void loop() {
#if defined(ESP32)
    serialConsole.poll(app);
    BacSysInfo::tick();
    uint32_t touchVal = touch.read();
    app.tick(touchVal);
#else
    app.tick(0);
#endif

    ui.update();
#if defined(ESP32)
    app.drawMessageOverlay(display);
#endif
    projet::update();

    framePacer.wait();
}
