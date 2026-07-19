#if defined(ESP32)

#include <cstring>
#include <nvs_flash.h>
#include <nvs.h>
#include "esp32-hal-tinyusb.h"

#if SOC_USB_OTG_SUPPORTED && CONFIG_TINYUSB_ENABLED && !ARDUINO_USB_MODE && ARDUINO_USB_CDC_ON_BOOT

#include <Arduino.h>
#include <USB.h>

namespace {

constexpr char kNvsNs[] = "bac";
constexpr char kNvsSerialKey[] = "serial_number";

char s_cdcInterfaceLabel[64] = "BAC-XS3";
bool s_cdcInterfaceLabelReady = false;

bool readSerialFromNvs(char *out, size_t outLen) {
    if (!out || outLen == 0) return false;
    out[0] = 0;
    nvs_handle_t handle = 0;
    if (nvs_open(kNvsNs, NVS_READONLY, &handle) != ESP_OK) return false;
    size_t len = outLen;
    esp_err_t err = nvs_get_str(handle, kNvsSerialKey, out, &len);
    nvs_close(handle);
    return err == ESP_OK && out[0] != 0;
}

void ensureNvs() {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
}

void refreshCdcInterfaceLabel() {
    if (s_cdcInterfaceLabelReady) return;
    s_cdcInterfaceLabelReady = true;
    ensureNvs();
    char serial[32] = {};
    if (readSerialFromNvs(serial, sizeof(serial))) {
        snprintf(s_cdcInterfaceLabel, sizeof(s_cdcInterfaceLabel), "BAC-XS3 %s", serial);
    }
}

struct BacUsbSerialRegistrar {
    BacUsbSerialRegistrar() {
        USB.manufacturerName("Techalchemy");
        USB.productName("BAC-XS3");
        refreshCdcInterfaceLabel();
        char serial[32] = {};
        if (readSerialFromNvs(serial, sizeof(serial))) {
            USB.serialNumber(serial);
        } else {
            USB.serialNumber("BAC-XS3-UNSET");
        }
    }
};

__attribute__((init_priority(65535))) BacUsbSerialRegistrar g_bacUsbSerialRegistrar;

}

extern "C" const char *bac_usb_cdc_interface_name(void) {
    refreshCdcInterfaceLabel();
    return s_cdcInterfaceLabel;
}

#endif

#endif
