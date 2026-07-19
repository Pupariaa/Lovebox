#include "Projet.h"
#include "Projet_setup.h"
#include <WiFi.h>

#if defined(ESP32)
#include "BacApp.h"
#include "BacDebug.h"
#include "BacScreenCache.h"
#include "BacSerialConsole.h"
#include "BacSysInfo.h"
#include "BacTouch.h"
#include "BacUsbIdentity.h"
#include "BacWatchdog.h"
#include "LoveboxFramePacer.h"
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
#if defined(ESP32)
  BacUsbIdentity::begin();
#endif
#if defined(ESP32)
  Serial.setRxBufferSize(4096);
#endif
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

  if (!display.begin(projet::displayPins(), projet::displayOptions(), buffer,
                     &SPI)) {
    BacDebug::reply("display init failed, continuing for wifi/ble/ota recovery");
  }

  projet::build(ui);
  ui.setTransition(Transition::Fade, 200);

  if (!projet::initStorage()) {
    BacDebug::reply("warning: volume assets unavailable");
  }

#if defined(ESP32)
  BacAssetsOta::bootIntegrityCheck();
#endif

  ui.begin();

  screenCache.begin(ui, &projet::screen_scr_mqxozray1);
  app.begin(ui, screenCache);
  app.beginBootFlow();
  projet::attachInput(ui);
  framePacer.begin(TARGET_FPS);
}

void loop() {
#if defined(ESP32)
  if (app.isUsbFlashActive()) {
    serialConsole.poll(app);
    BacWatchdog::feed();
    if (app.consumeUsbFlashUiPulse()) {
      ui.update();
      app.notifyUiRendered();
    }
    return;
  }
  serialConsole.poll(app);
  BacSysInfo::tick();
  uint32_t touchVal = touch.read();
  app.tick(touchVal);
  if (app.shouldUpdateUi()) {
    ui.update();
    app.drawMessageOverlay(display);
    projet::update();
    app.notifyUiRendered();
  }
  framePacer.setFps(app.targetFps() == 0 ? 1 : app.targetFps());
  framePacer.wait();
#else
  app.tick(0);
  ui.update();
  projet::update();
  framePacer.wait();
#endif
}
