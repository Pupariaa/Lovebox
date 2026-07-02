package com.tchy.boiteacoeur.data.ble

data class BleDeviceItem(
    val name: String,
    val address: String,
)

data class BleBoxIdentity(
    val deviceName: String,
    val serialNumber: String? = null,
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
    suspend fun awaitWifiResult(timeoutMs: Long = 90_000): Boolean
    suspend fun disconnect()
    fun boxIdentity(): BleBoxIdentity?
}
