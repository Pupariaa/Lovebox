#pragma once

#if defined(ESP32)

#include <WiFiClientSecure.h>

extern "C" {
extern const uint8_t x509_crt_bundle_start[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t x509_crt_bundle_end[] asm("_binary_x509_crt_bundle_end");
}

struct BacTls {
    static void configure(WiFiClientSecure &client) {
#if defined(BAC_DEV_INSECURE_TLS)
        client.setInsecure();
#else
        client.setCACertBundle(x509_crt_bundle_start, x509_crt_bundle_end - x509_crt_bundle_start);
#endif
    }
};

#else

struct BacTls {
    static void configure(WiFiClientSecure &) {}
};

#endif
