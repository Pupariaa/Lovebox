package com.tchy.boiteacoeur.data.ble

import android.bluetooth.le.ScanSettings
import android.util.Log
import com.juul.kable.Advertisement
import com.juul.kable.Peripheral
import com.juul.kable.Scanner
import com.juul.kable.WriteType
import com.juul.kable.characteristicOf
import com.juul.kable.peripheral
import com.tchy.boiteacoeur.AppConfig
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var peripheral: Peripheral? = null
    private val advertisements = mutableMapOf<String, Advertisement>()
    private val serviceUuid = Uuid.parse(AppConfig.BLE_SERVICE_UUID)
    private val statusCharUuid = Uuid.parse(AppConfig.BLE_WIFI_STATUS_CHAR_UUID)
    private val wifiCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_WIFI_CHAR_UUID,
    )
    private val gapNameCharacteristic = characteristicOf(
        service = "00001800-0000-1000-8000-00805f9b34fb",
        characteristic = "00002a00-0000-1000-8000-00805f9b34fb",
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
    private val statusCharacteristic = characteristicOf(
        service = AppConfig.BLE_SERVICE_UUID,
        characteristic = AppConfig.BLE_WIFI_STATUS_CHAR_UUID,
    )

    actual fun boxIdentity(): BleBoxIdentity? = boxIdentity

    actual suspend fun scan(timeoutMs: Long): List<BleDeviceItem> {
        val found = linkedMapOf<String, BleDeviceItem>()
        try {
            withTimeout(timeoutMs) {
                Scanner {
                    scanSettings = ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .build()
                }.advertisements.collect { ad ->
                    if (!ad.matchesBox()) return@collect
                    val address = ad.identifier.toString()
                    val name = ad.displayName()
                    val existing = found[address]
                    if (existing == null || preferName(name, existing.name)) {
                        found[address] = BleDeviceItem(name, address)
                    }
                    advertisements[address] = ad
                }
            }
        } catch (timeout: TimeoutCancellationException) {
            Log.d(TAG, "BLE scan window ended after ${timeoutMs}ms", timeout)
        }
        return found.values.sortedBy { it.name.lowercase() }
    }

    actual suspend fun connect(address: String, deviceName: String) {
        releasePeripheral()
        val ad = resolveAdvertisement(address, deviceName)
        val p = scope.peripheral(ad)
        peripheral = p
        withTimeout(CONNECT_TIMEOUT_MS) {
            p.connect()
        }
        awaitGattReady(p)
        ensureStatusReadable(p)
        boxIdentity = readBoxIdentity(p)
            ?: readGapDeviceName(p)?.let { BleBoxIdentity(it) }
            ?: deviceName.trim().takeIf { isUsableDeviceName(it) }?.let { BleBoxIdentity(it) }
        delay(POST_CONNECT_DELAY_MS)
    }

    actual suspend fun sendWifiCredentials(ssid: String, password: String) {
        val p = peripheral ?: throw IllegalStateException("not connected")
        val payload = "$ssid|$password".encodeToByteArray()
        if (payload.size > 127) throw IllegalArgumentException("payload too large")
        writeWifiCredentials(p, payload)
        delay(POST_WRITE_DELAY_MS)
    }

    actual suspend fun sendDeviceConfig(displayName: String, locale: String, region: String) {
        val p = peripheral ?: throw IllegalStateException("not connected")
        val payload = "${displayName.trim()}|${locale.trim()}|${region.trim()}".encodeToByteArray()
        if (payload.size > 191) throw IllegalArgumentException("payload too large")
        try {
            p.write(configCharacteristic, payload, WriteType.WithResponse)
        } catch (error: Exception) {
            Log.w(TAG, "GATT config write with response failed, retrying without response", error)
            p.write(configCharacteristic, payload, WriteType.WithoutResponse)
        }
        delay(POST_WRITE_DELAY_MS)
    }

    actual suspend fun awaitWifiResult(timeoutMs: Long): Boolean {
        val p = peripheral ?: throw IllegalStateException("not connected")
        return try {
            withTimeout(timeoutMs) {
                val status = waitForTerminalStatus(p)
                when (status) {
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
                delay(STATUS_POLL_MS)
            }
            BleProvStatus.IDLE
        } finally {
            notifyJob.cancel()
        }
    }

    private suspend fun confirmWifiSuccess(p: Peripheral): Boolean {
        repeat(WIFI_OK_CONFIRM_READS) { attempt ->
            val status = readProvisionStatus(p)
            if (status != BleProvStatus.OK) return false
            if (attempt < WIFI_OK_CONFIRM_READS - 1) delay(WIFI_OK_CONFIRM_DELAY_MS)
        }
        return true
    }

    private suspend fun resolveAdvertisement(address: String, deviceName: String): Advertisement {
        advertisements[address]?.let { return it }
        scan(SCAN_REFRESH_MS)
        advertisements[address]?.let { return it }
        val targetName = deviceName.trim().lowercase()
        advertisements.values.firstOrNull { ad ->
            ad.displayName().trim().lowercase() == targetName
        }?.let { return it }
        advertisements.values.firstOrNull { ad ->
            val lower = ad.displayName().lowercase()
            targetName.isNotBlank() && lower.contains(targetName)
        }?.let { return it }
        throw IllegalStateException("device not found, scan again")
    }

    private suspend fun awaitGattReady(p: Peripheral) {
        repeat(GATT_READY_RETRIES) {
            val services = p.services
            if (!services.isNullOrEmpty()) return
            delay(GATT_READY_POLL_MS)
        }
    }

    private suspend fun ensureStatusReadable(p: Peripheral) {
        repeat(STATUS_PROBE_RETRIES) {
            val services = p.services
            if (!services.isNullOrEmpty() && hasStatusInServices(services)) return
            if (runCatching { p.read(statusCharacteristic) }.isSuccess) return
            delay(STATUS_PROBE_DELAY_MS)
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

    private suspend fun writeWifiCredentials(p: Peripheral, payload: ByteArray) {
        try {
            p.write(wifiCharacteristic, payload, WriteType.WithResponse)
            return
        } catch (error: Exception) {
            Log.w(TAG, "GATT wifi write with response failed, retrying without response", error)
        }
        p.write(wifiCharacteristic, payload, WriteType.WithoutResponse)
    }

    private suspend fun readProvisionStatus(p: Peripheral): Byte {
        return try {
            val data = p.read(statusCharacteristic)
            data.firstOrNull() ?: BleProvStatus.IDLE
        } catch (_: Exception) {
            throw IllegalStateException("Connexion Bluetooth perdue avec la boîte")
        }
    }

    private suspend fun releasePeripheral() {
        val p = peripheral
        peripheral = null
        boxIdentity = null
        if (p == null) return
        try {
            p.disconnect()
        } catch (error: Exception) {
            Log.w(TAG, "GATT disconnect failed", error)
        }
    }

    @OptIn(ExperimentalUuidApi::class)
    private fun Advertisement.matchesBox(): Boolean {
        if (uuids.any { it == serviceUuid }) return true
        val lower = (name ?: peripheralName ?: "").lowercase()
        if (lower.isBlank()) return false
        return NAME_HINTS.any { lower.contains(it) }
    }

    private suspend fun readBoxIdentity(p: Peripheral): BleBoxIdentity? {
        return runCatching {
            val raw = p.read(deviceInfoCharacteristic).decodeToString()
            parseBleBoxIdentity(raw)
        }.getOrNull()
    }

    private suspend fun readGapDeviceName(p: Peripheral): String? {
        return runCatching {
            p.read(gapNameCharacteristic).decodeToString().trim().takeIf { isUsableDeviceName(it) }
        }.getOrNull()
    }

    private fun isUsableDeviceName(name: String): Boolean = isUsableBleDeviceName(name)

    private fun preferName(candidate: String, current: String): Boolean {
        if (!isUsableDeviceName(current)) return isUsableDeviceName(candidate)
        if (!isUsableDeviceName(candidate)) return false
        return candidate.length > current.length
    }

    private fun Advertisement.displayName(): String {
        val raw = name?.trim().orEmpty().ifBlank { peripheralName?.trim().orEmpty() }
        return raw.ifBlank { DEFAULT_BLE_NAME }
    }

    private companion object {
        const val TAG = "BleProvisioner"
        const val DEFAULT_BLE_NAME = "BoiteACoeur"
        const val CONNECT_TIMEOUT_MS = 30_000L
        const val SCAN_REFRESH_MS = 8_000L
        const val POST_CONNECT_DELAY_MS = 600L
        const val POST_WRITE_DELAY_MS = 250L
        const val STATUS_POLL_MS = 400L
        const val GATT_READY_POLL_MS = 250L
        const val GATT_READY_RETRIES = 48
        const val STATUS_PROBE_DELAY_MS = 400L
        const val STATUS_PROBE_RETRIES = 20
        const val WIFI_OK_CONFIRM_READS = 2
        const val WIFI_OK_CONFIRM_DELAY_MS = 800L
        val NAME_HINTS = listOf("bac", "boite", "coeur", "boiteacoeur", "lovebox")
    }
}
