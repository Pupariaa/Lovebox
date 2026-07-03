package com.tchy.boiteacoeur.data.ble

data class BleDeviceItem(
    val name: String,
    val address: String,
)

data class BleBoxIdentity(
    val deviceName: String,
    val serialNumber: String? = null,
    val uuid: String? = null,
)

object BleProvStatus {
    const val IDLE: Byte = 0
    const val CONNECTING: Byte = 1
    const val OK: Byte = 2
    const val FAIL: Byte = 3
}

expect class BleProvisioner() {
    suspend fun scan(timeoutMs: Long = 12000): List<BleDeviceItem>
    suspend fun connect(address: String, deviceName: String)
    suspend fun sendWifiCredentials(ssid: String, password: String)
    suspend fun sendDeviceConfig(displayName: String, locale: String, region: String)
    suspend fun awaitWifiResult(timeoutMs: Long = 90_000): Boolean
    suspend fun disconnect()
    fun boxIdentity(): BleBoxIdentity?
}

fun parseBleBoxIdentity(raw: String): BleBoxIdentity? {
    val trimmed = raw.trim()
    if (trimmed.isBlank()) return null
    val parts = trimmed.split('|')
    val name = parts.getOrNull(0)?.trim().orEmpty()
    val serial = parts.getOrNull(1)?.trim()?.takeIf { it.isNotBlank() }
    val uuid = parts.getOrNull(2)?.trim()?.takeIf { it.isNotBlank() }
    if (!isUsableBleDeviceName(name)) return null
    return BleBoxIdentity(name, serial, uuid)
}

internal fun isUsableBleDeviceName(name: String): Boolean {
    val trimmed = name.trim()
    if (trimmed.isBlank()) return false
    return !trimmed.equals("BoiteACoeur", ignoreCase = true)
}
