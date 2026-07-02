#ifndef PROJET_SETUP_H
#define PROJET_SETUP_H

#include "LucarneUserConfig.h"
#include <LucarneStorageConfig.h>
#include <SPI.h>
#if LUCARNE_ENABLE_SD
#include <SD.h>
#endif
#include <Lucarne.h>
#include "BacDebug.h"

namespace projet {

inline void initSpiBus() {
    SPI.end();
    delay(10);
    SPI.begin(17, -1, 18, 17);
}

inline lucarne::DisplayPins displayPins() {
    lucarne::DisplayPins pins;
    pins.cs = 16;
    pins.dc = 15;
    pins.rst = 8;
    pins.mosi = 18;
    pins.miso = -1;
    pins.sclk = 17;
    pins.bl = -1;
    return pins;
}

inline lucarne::DisplayOptions displayOptions() {
    lucarne::DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.rotation = 1;
    options.spiHz = 40000000;
    options.spiMode = 3;
    options.colorOrder = lucarne::ColorOrder::RGB;
    options.invert = true;
    return options;
}

inline bool mountSdCard() {
#if LUCARNE_ENABLE_SD
    return SD.begin(17, SPI, 4000000);
#else
    return false;
#endif
}

inline bool mountVolume() {
    return lucarne::mountVolume(lucarne::VolumeFsKind::Fat, "ffat");
}

inline bool initStorage() {
    bool ok = true;
#if LUCARNE_ENABLE_SD
    if (!mountSdCard()) {
        BacDebug::reply("Lucarne: SD mount failed (check CS/wiring/FAT32)");
        ok = false;
    } else {
        BAC_LOG("storage", "SD mounted");
    }
#endif
#if LUCARNE_ENABLE_VOLUME
    if (!mountVolume()) {
        ok = false;
    }
#endif
    return ok;
}

}  // namespace projet

#endif