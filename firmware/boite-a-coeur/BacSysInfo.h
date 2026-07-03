#pragma once

#if defined(ESP32)

#include <Arduino.h>
#include <FFat.h>
#include <esp_freertos_hooks.h>
#include <esp_heap_caps.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <Lucarne.h>
#include "BacDebug.h"

static DRAM_ATTR volatile uint32_t bacSysIdle0 = 0;
static DRAM_ATTR volatile uint32_t bacSysIdle1 = 0;
static bool bacSysHooksReady = false;
static uint32_t bacSysPeakIdle0 = 1;
static uint32_t bacSysPeakIdle1 = 1;
static uint32_t bacSysLastIdle0 = 0;
static uint32_t bacSysLastIdle1 = 0;
static uint32_t bacSysLastTickMs = 0;

static bool IRAM_ATTR bacSysIdleHook0() {
    bacSysIdle0++;
    return false;
}

static bool IRAM_ATTR bacSysIdleHook1() {
    bacSysIdle1++;
    return false;
}

struct BacSysInfo {
    static void initCpuHooks() {
        if (bacSysHooksReady) return;
        bacSysLastIdle0 = bacSysIdle0;
        bacSysLastIdle1 = bacSysIdle1;
        bacSysLastTickMs = millis();
        esp_register_freertos_idle_hook_for_cpu(&bacSysIdleHook0, 0);
        esp_register_freertos_idle_hook_for_cpu(&bacSysIdleHook1, 1);
        bacSysHooksReady = true;
    }

    static void tick() {
        if (!bacSysHooksReady) return;
        uint32_t now = millis();
        if (now - bacSysLastTickMs < 500) return;
        uint32_t d0 = bacSysIdle0 - bacSysLastIdle0;
        uint32_t d1 = bacSysIdle1 - bacSysLastIdle1;
        bacSysLastIdle0 = bacSysIdle0;
        bacSysLastIdle1 = bacSysIdle1;
        bacSysLastTickMs = now;
        updatePeak(d0, bacSysPeakIdle0);
        updatePeak(d1, bacSysPeakIdle1);
    }

    static void printReport() {
        initCpuHooks();
        BacDebug::reply("--- memory ---");
        printMemory();
        BacDebug::reply("--- cpu ---");
        printCpu();
        BacDebug::reply("--- partitions ---");
        printPartitions();
    }

    static void printMemory() {
        uint32_t intTotal = heap_caps_get_total_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
        uint32_t intFree = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
        uint32_t intUsed = intTotal > intFree ? intTotal - intFree : 0;
        uint32_t intLargest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
        uint32_t intMin = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);

        Serial.print(F("sram_total: "));
        Serial.println(intTotal);
        Serial.print(F("sram_used: "));
        Serial.println(intUsed);
        Serial.print(F("sram_free: "));
        Serial.println(intFree);
        Serial.print(F("sram_largest_block: "));
        Serial.println(intLargest);
        Serial.print(F("sram_min_free: "));
        Serial.println(intMin);

        uint32_t psramTotal = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
        if (psramTotal > 0) {
            uint32_t psramFree = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
            uint32_t psramUsed = psramTotal > psramFree ? psramTotal - psramFree : 0;
            uint32_t psramLargest = heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM);
            Serial.print(F("psram_total: "));
            Serial.println(psramTotal);
            Serial.print(F("psram_used: "));
            Serial.println(psramUsed);
            Serial.print(F("psram_free: "));
            Serial.println(psramFree);
            Serial.print(F("psram_largest_block: "));
            Serial.println(psramLargest);
        } else {
            Serial.println(F("psram: none"));
        }

        uint32_t dmaFree = heap_caps_get_free_size(MALLOC_CAP_DMA);
        uint32_t dmaTotal = heap_caps_get_total_size(MALLOC_CAP_DMA);
        Serial.print(F("dma_total: "));
        Serial.println(dmaTotal);
        Serial.print(F("dma_free: "));
        Serial.println(dmaFree);

        Serial.print(F("heap_free: "));
        Serial.println(ESP.getFreeHeap());
        Serial.print(F("heap_min: "));
        Serial.println(ESP.getMinFreeHeap());
        Serial.print(F("heap_max_alloc: "));
        Serial.println(ESP.getMaxAllocHeap());
        Serial.print(F("sketch_size: "));
        Serial.println(ESP.getSketchSize());
        Serial.print(F("sketch_slot_free: "));
        Serial.println(appSlotFree(esp_ota_get_running_partition()));
    }

    static void printCpu() {
        uint32_t i0 = bacSysIdle0;
        uint32_t i1 = bacSysIdle1;
        delay(500);
        updatePeak(bacSysIdle0 - i0, bacSysPeakIdle0);
        updatePeak(bacSysIdle1 - i1, bacSysPeakIdle1);
        i0 = bacSysIdle0;
        i1 = bacSysIdle1;
        delay(500);
        uint32_t d0 = bacSysIdle0 - i0;
        uint32_t d1 = bacSysIdle1 - i1;
        float cpu0 = cpuPercent(d0, bacSysPeakIdle0);
        float cpu1 = cpuPercent(d1, bacSysPeakIdle1);
        Serial.print(F("cpu0_load_pct: "));
        Serial.println(cpu0, 1);
        Serial.print(F("cpu1_load_pct: "));
        Serial.println(cpu1, 1);
        Serial.print(F("cpu_freq_mhz: "));
        Serial.println(getCpuFrequencyMhz());
    }

    static void printPartitions() {
        const esp_partition_t *running = esp_ota_get_running_partition();
        const esp_partition_t *boot = esp_ota_get_boot_partition();
        if (running) {
            Serial.print(F("running: "));
            Serial.println(running->label);
        }
        if (boot) {
            Serial.print(F("boot: "));
            Serial.println(boot->label);
        }

        esp_partition_iterator_t it = esp_partition_find(ESP_PARTITION_TYPE_ANY, ESP_PARTITION_SUBTYPE_ANY, nullptr);
        while (it) {
            const esp_partition_t *p = esp_partition_get(it);
            printPartitionLine(p, running);
            it = esp_partition_next(it);
        }
        esp_partition_iterator_release(it);
    }

private:
    struct VolumeStats {
        uint32_t files = 0;
        uint64_t bytes = 0;
        uint64_t allocBytes = 0;
    };

    static void collectVolumeStats(fs::FS &fs, const char *path, VolumeStats &stats, uint32_t clusterSize) {
        File dir = fs.open(path);
        if (!dir || !dir.isDirectory()) {
            if (dir) dir.close();
            return;
        }
        File entry;
        while ((entry = dir.openNextFile())) {
            if (entry.isDirectory()) {
                String child = String(path);
                if (!child.endsWith("/")) child += "/";
                child += entry.name();
                collectVolumeStats(fs, child.c_str(), stats, clusterSize);
            } else {
                uint64_t size = entry.size();
                stats.files++;
                stats.bytes += size;
                if (clusterSize > 0) {
                    uint64_t clusters = (size + clusterSize - 1) / clusterSize;
                    stats.allocBytes += clusters * clusterSize;
                }
            }
            entry.close();
        }
        dir.close();
    }

    static uint32_t appSlotFree(const esp_partition_t *part) {
        if (!part) return 0;
        uint32_t used = ESP.getSketchSize();
        if (part->size <= used) return 0;
        return part->size - used;
    }

    static void printPartitionLine(const esp_partition_t *p, const esp_partition_t *running) {
        if (!p) return;
        Serial.print(p->label);
        Serial.print(F(" | "));
        Serial.print(typeName(p->type));
        Serial.print(F("/"));
        Serial.print(subtypeName(p->type, p->subtype));
        Serial.print(F(" | off 0x"));
        Serial.print(p->address, HEX);
        Serial.print(F(" | size "));
        Serial.print(p->size);
        Serial.print(F(" ("));
        Serial.print(formatBytes(p->size));
        Serial.print(F(")"));

        if (p->type == ESP_PARTITION_TYPE_APP) {
            bool isRunning = running && p->address == running->address;
            if (isRunning) {
                uint32_t used = ESP.getSketchSize();
                Serial.print(F(" | used "));
                Serial.print(used);
                Serial.print(F(" free "));
                Serial.print(appSlotFree(p));
            } else {
                esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
                if (esp_ota_get_state_partition(p, &state) == ESP_OK) {
                    Serial.print(F(" | ota_state "));
                    Serial.print(otaStateName(state));
                }
            }
        } else if (p->type == ESP_PARTITION_TYPE_DATA && p->subtype == ESP_PARTITION_SUBTYPE_DATA_FAT) {
            if (lucarne::volumeMounted()) {
                const uint32_t clusterSize = 4096;
                VolumeStats stats = {};
                if (fs::FS *vol = lucarne::volumeFs()) {
                    collectVolumeStats(*vol, "/", stats, clusterSize);
                }
                uint64_t volumeTotal = FFat.totalBytes();
                if (volumeTotal == 0) volumeTotal = p->size;
                uint64_t usedEst = stats.allocBytes;
                if (usedEst < stats.bytes) usedEst = stats.bytes;
                uint64_t freeEst = volumeTotal > usedEst ? volumeTotal - usedEst : 0;
                Serial.print(F(" | used "));
                Serial.print((uint32_t)usedEst);
                Serial.print(F(" free "));
                Serial.print((uint32_t)freeEst);
                Serial.print(F(" | files "));
                Serial.print(stats.files);
                Serial.print(F(" content "));
                Serial.print((uint32_t)stats.bytes);
            } else {
                Serial.print(F(" | mount: no"));
            }
        }

        Serial.println();
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

    static const char *typeName(uint8_t type) {
        switch (type) {
            case ESP_PARTITION_TYPE_APP: return "app";
            case ESP_PARTITION_TYPE_DATA: return "data";
            default: return "other";
        }
    }

    static const char *subtypeName(uint8_t type, uint8_t subtype) {
        if (type == ESP_PARTITION_TYPE_APP) {
            switch (subtype) {
                case ESP_PARTITION_SUBTYPE_APP_FACTORY: return "factory";
                case ESP_PARTITION_SUBTYPE_APP_OTA_0: return "ota_0";
                case ESP_PARTITION_SUBTYPE_APP_OTA_1: return "ota_1";
                case ESP_PARTITION_SUBTYPE_APP_OTA_2: return "ota_2";
                default: return "app";
            }
        }
        if (type == ESP_PARTITION_TYPE_DATA) {
            switch (subtype) {
                case ESP_PARTITION_SUBTYPE_DATA_OTA: return "ota";
                case ESP_PARTITION_SUBTYPE_DATA_NVS: return "nvs";
                case ESP_PARTITION_SUBTYPE_DATA_FAT: return "fat";
                case ESP_PARTITION_SUBTYPE_DATA_SPIFFS: return "spiffs";
                default: return "data";
            }
        }
        return "?";
    }

    static const char *otaStateName(esp_ota_img_states_t state) {
        switch (state) {
            case ESP_OTA_IMG_NEW: return "new";
            case ESP_OTA_IMG_PENDING_VERIFY: return "pending_verify";
            case ESP_OTA_IMG_VALID: return "valid";
            case ESP_OTA_IMG_INVALID: return "invalid";
            case ESP_OTA_IMG_ABORTED: return "aborted";
            default: return "undefined";
        }
    }

    static String formatBytes(uint32_t bytes) {
        char buf[24];
        if (bytes >= 1024 * 1024) {
            snprintf(buf, sizeof(buf), "%.2f MB", (double)bytes / (1024.0 * 1024.0));
        } else if (bytes >= 1024) {
            snprintf(buf, sizeof(buf), "%.1f KB", (double)bytes / 1024.0);
        } else {
            snprintf(buf, sizeof(buf), "%lu B", (unsigned long)bytes);
        }
        return String(buf);
    }
};

#else

struct BacSysInfo {
    static void initCpuHooks() {}
    static void tick() {}
    static void printReport() {}
};

#endif
