# BLE WiFi provisioning

WiFi credentials are delivered over BLE during first setup or when the device is in `Lost` mode (no stored SSID or prolonged disconnect).

## GATT service

| Item | UUID |
| --- | --- |
| Service | `bac1c201-1fb5-459e-8fcc-c5c9c331914b` |
| WiFi write characteristic | `bac1c202-36e1-4688-b7f5-ea07361b26a8` |

Properties: write, write without response. Max payload: 127 bytes.

## Credential format

Write a UTF-8 string with SSID and password separated by either:

- **Pipe:** `MyNetwork|secretpass`
- **Newline:** `MyNetwork\nsecretpass`

SSID max 32 characters, password max 63. Whitespace is trimmed. Empty SSID is rejected.

## Device behaviour

1. `BacBle::openProvisioning()` starts advertising with `device_name` from `user.txt`.
2. On characteristic write, `BacApp::onWifiProvision()` stores pending SSID/password.
3. BLE advertising stops on connect; resumes on disconnect if still provisioning.
4. After successful WiFi join, credentials are saved to `user.txt` and BLE shuts down (`closeProvisioning`).
5. Failed connect shows `first_wifi_error` or returns to `lost_connection`.

## When BLE is active

| Situation | Screen | Mode |
| --- | --- | --- |
| First setup, WiFi step | `first_p3` / connecting | `FirstSetup` |
| No WiFi at boot | `lost_connection` | `Lost` |
| User disconnects WiFi in settings | `lost_connection` | `Lost` |
| Link lost in idle (grace 15 s) | `lost_connection` | `Lost` |

## Coexistence

During WiFi connect after provisioning, BLE may still be winding down. `BacWifi` sets WiFi-preferred coexistence before `WiFi.begin()`.

## Testing without a phone

Use the Flask simulator in `firmware/boite-a-coeur/ble-sim/` — scan, connect, and provision from the browser. See [BLE_SIM.md](BLE_SIM.md).

## Security notes

Provisioning is open (no pairing PIN). Credentials travel in cleartext over BLE. Use only on trusted networks during setup. The HTTP message API on port 8080 is likewise unauthenticated on the LAN.
