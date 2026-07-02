# Screens

Screens come from Studio export (`Projet.h`) plus one firmware screen (`BacScreens.h`). `BacApp` and menus reference screens by their `name` string.

## Studio screens

| Name | Role |
| --- | --- |
| `splash_screen` | Boot splash; cache warming anchor |
| `first_p1` | First setup welcome |
| `first_p2` | First setup step 2 |
| `first_p3` | First setup WiFi instruction |
| `first_p3_wifi_connecting` | WiFi connect in progress |
| `first_p4` | First setup completion |
| `first_wifi_error` | WiFi failed during setup |
| `lost_connection` | No WiFi; BLE provisioning |
| `idle` | Home screen when connected |
| `new_message` | Message notification |
| `settings_menu` | Settings entry (long-press) |
| `settings` | Settings submenu hub |
| `settings_wifi` | WiFi settings |
| `settings_date_hours` | Clock / timezone |
| `settings_disconnect` | Confirm disconnect |
| `settings_disconnecting` | Disconnect in progress |
| `settings_disconnected` | WiFi cleared |
| `settings_wifi_test` | Internet test running |
| `settings_wifi_success` | Internet test OK |
| `settings_wifi_error` | Internet test failed |
| `settings_informations` | Device info |
| `settings_factory_reset` | Factory reset confirm |
| `settings_fatory_reseting` | Reset in progress (typo preserved in export) |

## Firmware screen

| Name | File | Role |
| --- | --- | --- |
| `message_opened` | `BacScreens.h` | Full-screen BACM render |

## Navigation highlights

| Trigger | Target |
| --- | --- |
| Boot, not configured | `first_p1` |
| Boot, no WiFi | `lost_connection` |
| WiFi OK after boot | `idle` |
| Link lost | `lost_connection` |
| Message received (idle) | `new_message` → tap → `message_opened` |
| Long-press on idle/lost | `settings_menu` |
| Settings → Quitter | `idle` |
| Factory reset complete | `first_p1` |

## C++ symbols

Studio generates `projet::screen_scr_<id>` objects; the `name` column above is what `Screen::name()` returns and what `BacApp::onCurrentScreen("...")` compares.

Example mapping:

```
screen_scr_mqzyaiw41j  →  "idle"
screen_scr_mqxp1ppa3   →  "new_message"
screen_scr_mqwqhtj72   →  "lost_connection"
```

Prefer matching by `name` in new code so exports can change internal IDs without breaking logic.

## Screen cache

`BacScreenCache` pre-warms assets for boot screens and lazily queues neighbours. Splash (`splash_screen`) is the buffer restore target during warming.
