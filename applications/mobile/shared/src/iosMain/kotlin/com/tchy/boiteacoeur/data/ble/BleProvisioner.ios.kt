package com.tchy.boiteacoeur.data.ble

import com.juul.kable.Peripheral
import com.juul.kable.Scanner
import com.juul.kable.WriteType
import com.juul.kable.characteristicOf
import com.tchy.boiteacoeur.AppConfig
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withTimeout

@OptIn(ExperimentalUuidApi::class)
actual class BleProvisioner actual constructor() {
    private var peripheral: Peripheral? = null
    private val serviceUuid = Uuid.parse(AppConfig.BLE_SERVICE_UUID)
    private val statusCharUuid = Uuid.parse(AppConfig.BLE_WIFI_STATUS_CHAR_UUID)
    private val wifiCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_WIFI_CHAR_UUID,
    )
    private val statusCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_WIFI_STATUS_CHAR_UUID,
    )
    private val deviceInfoCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_DEVICE_INFO_CHAR_UUID,
    )
    private val configCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_CONFIG_CHAR_UUID,
    )
    private var boxIdentity: BleBoxIdentity? = null

    actual suspend fun scan(timeoutMs: Long): List<BleDeviceItem> {
        val found = linkedMapOf<String, BleDeviceItem>()
        try {
            withTimeout(timeoutMs) {
                Scanner().advertisements.collect { ad ->
                    val name = ad.name ?: ""
                    val lower = name.lowercase()
                    if (lower.contains("bac") || lower.contains("boite") || lower.contains("coeur")) {
                        found[ad.identifier] = BleDeviceItem(name.ifBlank { "BoiteACoeur" }, ad.identifier)
                    }
                }
            }
        } catch (_: TimeoutCancellationException) {
        }
        return found.values.toList()
    }

    actual suspend fun connect(address: String, deviceName: String) {
        releasePeripheral()
        val p = Peripheral(address)
        peripheral = p
        withTimeout(30_000) {
            p.connect()
        }
        awaitGattReady(p)
        ensureStatusReadable(p)
        boxIdentity = readBoxIdentity(p)
            ?: deviceName.trim().takeIf { isUsableDeviceName(it) }?.let { BleBoxIdentity(it) }
        delay(600)
    }

    actual fun boxIdentity(): BleBoxIdentity? = boxIdentity

    actual suspend fun sendWifiCredentials(ssid: String, password: String) {
        val p = peripheral ?: throw IllegalStateException("not connected")
        val payload = "$ssid|$password".encodeToByteArray()
        if (payload.size > 127) throw IllegalArgumentException("payload too large")
        try {
            p.write(wifiCharacteristic, payload, WriteType.WithResponse)
        } catch (_: Exception) {
            p.write(wifiCharacteristic, payload, WriteType.WithoutResponse)
        }
        delay(250)
    }

    actual suspend fun sendDeviceConfig(displayName: String, locale: String, region: String) {
        val p = peripheral ?: throw IllegalStateException("not connected")
        val payload = "${displayName.trim()}|${locale.trim()}|${region.trim()}".encodeToByteArray()
        if (payload.size > 191) throw IllegalArgumentException("payload too large")
        try {
            p.write(configCharacteristic, payload, WriteType.WithResponse)
        } catch (_: Exception) {
            p.write(configCharacteristic, payload, WriteType.WithoutResponse)
        }
        delay(250)
    }

    actual suspend fun awaitWifiResult(timeoutMs: Long): Boolean {
        val p = peripheral ?: throw IllegalStateException("not connected")
        return try {
            withTimeout(timeoutMs) {
                when (waitForTerminalStatus(p)) {
                    BleProvStatus.OK -> confirmWifiSuccess(p)
                    BleProvStatus.FAIL -> false
                    else -> false
                }
            }
        } catch (_: TimeoutCancellationException) {
            throw IllegalStateException("La boîte met trop de temps à se connecter au WiFi")
        } finally {
            releasePeripheral()
        }
    }

    actual suspend fun disconnect() {
        releasePeripheral()
    }

    private suspend fun waitForTerminalStatus(p: Peripheral): Byte = coroutineScope {
        val notifyJob = async {
            p.observe(statusCharacteristic).first { data ->
                val status = data.firstOrNull() ?: BleProvStatus.IDLE
                status == BleProvStatus.OK || status == BleProvStatus.FAIL
            }.firstOrNull() ?: BleProvStatus.IDLE
        }
        try {
            while (isActive) {
                if (notifyJob.isCompleted) {
                    val status = notifyJob.getCompleted()
                    if (status == BleProvStatus.OK || status == BleProvStatus.FAIL) return@coroutineScope status
                }
                val status = readProvisionStatus(p)
                if (status == BleProvStatus.OK || status == BleProvStatus.FAIL) return@coroutineScope status
                delay(400)
            }
            BleProvStatus.IDLE
        } finally {
            notifyJob.cancel()
        }
    }

    private suspend fun confirmWifiSuccess(p: Peripheral): Boolean {
        repeat(2) { attempt ->
            if (readProvisionStatus(p) != BleProvStatus.OK) return false
            if (attempt == 0) delay(800)
        }
        return true
    }

    private suspend fun awaitGattReady(p: Peripheral) {
        repeat(48) {
            val services = p.services
            if (!services.isNullOrEmpty()) return
            delay(250)
        }
    }

    private suspend fun ensureStatusReadable(p: Peripheral) {
        repeat(20) {
            val services = p.services
            if (!services.isNullOrEmpty() && hasStatusInServices(services)) return
            if (runCatching { p.read(statusCharacteristic) }.isSuccess) return
            delay(400)
        }
        throw IllegalStateException(
            "Impossible de lire le statut WiFi de la boîte. Redémarre-la, supprime le jumelage Bluetooth sur le téléphone et réessaie.",
        )
    }

    private fun hasStatusInServices(services: List<com.juul.kable.DiscoveredService>): Boolean {
        return services.any { service ->
            service.serviceUuid == serviceUuid &&
                service.characteristics.any { it.characteristicUuid == statusCharUuid }
        }
    }

    private suspend fun readProvisionStatus(p: Peripheral): Byte {
        return try {
            val data = p.read(statusCharacteristic)
            data.firstOrNull() ?: BleProvStatus.IDLE
        } catch (_: Exception) {
            throw IllegalStateException("Connexion Bluetooth perdue avec la boîte")
        }
    }

    private suspend fun readBoxIdentity(p: Peripheral): BleBoxIdentity? {
        return runCatching {
            val raw = p.read(deviceInfoCharacteristic).decodeToString()
            parseBleBoxIdentity(raw)
        }.getOrNull()
    }

    private fun isUsableDeviceName(name: String): Boolean = isUsableBleDeviceName(name)

    private suspend fun releasePeripheral() {
        val p = peripheral
        peripheral = null
        boxIdentity = null
        if (p == null) return
        try {
            p.disconnect()
        } catch (_: Exception) {
        }
    }
}
