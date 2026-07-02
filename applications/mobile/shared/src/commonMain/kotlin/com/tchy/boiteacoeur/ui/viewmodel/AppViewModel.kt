package com.tchy.boiteacoeur.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.tchy.boiteacoeur.data.api.ApiClient
import com.tchy.boiteacoeur.data.api.ApiException
import com.tchy.boiteacoeur.data.api.mapApiError
import com.tchy.boiteacoeur.data.ble.BleDeviceItem
import com.tchy.boiteacoeur.data.ble.BleProvisioner
import com.tchy.boiteacoeur.data.model.DeviceDto
import com.tchy.boiteacoeur.data.model.LinkedTargetDto
import com.tchy.boiteacoeur.data.model.MessageScene
import com.tchy.boiteacoeur.data.model.OwnedDeviceDto
import com.tchy.boiteacoeur.data.model.PendingRequestDto
import com.tchy.boiteacoeur.data.model.SentMessageDto
import com.tchy.boiteacoeur.data.storage.TokenStorage
import com.tchy.boiteacoeur.domain.bacm.BacMessagePack
import com.tchy.boiteacoeur.domain.bacm.EmojiFrameLoader
import com.tchy.boiteacoeur.domain.bacm.SceneRasterizer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AppViewModel {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val tokens = TokenStorage()
    private val api = ApiClient(tokens)
    private val ble = BleProvisioner()
    private val rasterizer = SceneRasterizer()

    var isLoggedIn by mutableStateOf(false)
    var loading by mutableStateOf(false)
    var snackbarMessage by mutableStateOf<String?>(null)

    var ownedDevice by mutableStateOf<OwnedDeviceDto?>(null)
    var myDevice by mutableStateOf<DeviceDto?>(null)
    var linkedTarget by mutableStateOf<LinkedTargetDto?>(null)
    var pendingRequests by mutableStateOf<List<PendingRequestDto>>(emptyList())
    var inviteUrl by mutableStateOf<String?>(null)

    var bleDevices by mutableStateOf<List<BleDeviceItem>>(emptyList())
    var bleProvisionPhase by mutableStateOf(BleProvisionPhase.Idle)
    var bleProvisionError by mutableStateOf<String?>(null)
    var bleProvisionDeviceName by mutableStateOf<String?>(null)
    var bleProvisionSerialNumber by mutableStateOf<String?>(null)
    var bleWifiProvisioned by mutableStateOf(false)
    var claimDeviceName by mutableStateOf("")
    var pairDeviceName by mutableStateOf("")

    var composerScene by mutableStateOf(BacMessagePack.createDefaultScene())
    var history by mutableStateOf<List<SentMessageDto>>(emptyList())

    var pendingInviteToken: String? = null
    var forceAuth by mutableStateOf(false)

    fun clearSnackbar() {
        snackbarMessage = null
    }

    private fun clearSession() {
        api.clearLocalSession()
        isLoggedIn = false
        ownedDevice = null
        myDevice = null
        linkedTarget = null
        pendingRequests = emptyList()
        forceAuth = true
    }

    private fun userMessage(error: Throwable): String =
        if (error is ApiException) error.message ?: "Erreur réseau"
        else mapApiError(error.message ?: "Erreur réseau")

    suspend fun bootstrap(): Boolean {
        if (tokens.getAccessToken() == null) {
            isLoggedIn = false
            return false
        }
        return runCatching {
            loadRemoteState()
            isLoggedIn = true
            true
        }.getOrElse { error ->
            if (error is ApiException && error.status == 401) {
                clearSession()
            }
            false
        }
    }

    private suspend fun loadRemoteState() {
        myDevice = api.getMyDevice().device
        val pairing = api.getPairingState()
        ownedDevice = pairing.ownedDevice
        linkedTarget = pairing.linkedTarget
        pendingRequests = pairing.pendingRequests
        pendingInviteToken?.let { token ->
            api.acceptInvite(token)
            pendingInviteToken = null
            val refreshed = api.getPairingState()
            linkedTarget = refreshed.linkedTarget
            snackbarMessage = "Invitation acceptée"
        }
    }

    fun login(email: String, password: String, onSuccess: () -> Unit) {
        scope.launch {
            loading = true
            runCatching { api.login(email, password) }
                .onSuccess {
                    isLoggedIn = true
                    runCatching { loadRemoteState() }
                        .onFailure { snackbarMessage = userMessage(it) }
                    onSuccess()
                }
                .onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun register(email: String, password: String, onSuccess: () -> Unit) {
        scope.launch {
            loading = true
            runCatching { api.register(email, password) }
                .onSuccess {
                    isLoggedIn = true
                    runCatching { loadRemoteState() }
                        .onFailure { snackbarMessage = userMessage(it) }
                    onSuccess()
                }
                .onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun logout() {
        scope.launch {
            runCatching { api.logout() }
            isLoggedIn = false
            ownedDevice = null
            myDevice = null
            linkedTarget = null
        }
    }

    fun refreshState() {
        scope.launch {
            loading = true
            runCatching { loadRemoteState() }
                .onFailure { error ->
                    if (error is ApiException && error.status == 401) {
                        clearSession()
                    } else {
                        snackbarMessage = userMessage(error)
                    }
                }
            loading = false
        }
    }

    fun scanBle() {
        scope.launch {
            loading = true
            runCatching { bleDevices = ble.scan() }
                .onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun resetBleProvision() {
        bleProvisionPhase = BleProvisionPhase.Idle
        bleProvisionError = null
        bleWifiProvisioned = false
        bleProvisionSerialNumber = null
    }

    fun provisionBle(
        address: String,
        deviceName: String,
        ssid: String,
        password: String,
        onFinished: (success: Boolean) -> Unit,
    ) {
        scope.launch {
            loading = true
            bleProvisionError = null
            bleWifiProvisioned = false
            bleProvisionDeviceName = deviceName
            bleProvisionPhase = BleProvisionPhase.Connecting

            val connectResult = withContext(Dispatchers.IO) {
                runCatching { ble.connect(address, deviceName) }
            }
            if (connectResult.isFailure) {
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = bleConnectError(connectResult.exceptionOrNull()!!)
                runCatching { ble.disconnect() }
                onFinished(false)
                loading = false
                return@launch
            }

            val identity = withContext(Dispatchers.IO) { ble.boxIdentity() }
            val resolvedName = identity?.deviceName?.trim().orEmpty().ifBlank { deviceName.trim() }
            if (resolvedName.isBlank() || resolvedName.equals("BoiteACoeur", ignoreCase = true)) {
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = "Impossible de lire l'identité de la boîte. Reflashe le firmware et réessaie."
                runCatching { ble.disconnect() }
                onFinished(false)
                loading = false
                return@launch
            }
            bleProvisionDeviceName = resolvedName
            bleProvisionSerialNumber = identity?.serialNumber?.trim()?.takeIf { it.isNotBlank() }

            bleProvisionPhase = BleProvisionPhase.SendingWifi
            val sendResult = withContext(Dispatchers.IO) {
                runCatching { ble.sendWifiCredentials(ssid, password) }
            }
            if (sendResult.isFailure) {
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = userMessage(sendResult.exceptionOrNull()!!)
                runCatching { ble.disconnect() }
                onFinished(false)
                loading = false
                return@launch
            }

            bleProvisionPhase = BleProvisionPhase.WaitingForBox
            val wifiOkResult = withContext(Dispatchers.IO) {
                runCatching { ble.awaitWifiResult() }
            }
            if (wifiOkResult.isFailure) {
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = userMessage(wifiOkResult.exceptionOrNull()!!)
                onFinished(false)
                loading = false
                return@launch
            }
            if (wifiOkResult.getOrDefault(false) != true) {
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = "La boîte n'a pas pu se connecter au WiFi. Vérifie que le réseau est en 2,4 GHz et que le mot de passe est correct."
                runCatching { ble.disconnect() }
                onFinished(false)
                loading = false
                return@launch
            }

            bleWifiProvisioned = true
            bleProvisionPhase = BleProvisionPhase.LinkingAccount
            runCatching {
                claimDeviceWhenOnline(
                    deviceName = bleProvisionDeviceName?.trim().orEmpty().ifBlank { deviceName.trim() },
                    serialNumber = bleProvisionSerialNumber,
                )
                loadRemoteState()
                bleProvisionPhase = BleProvisionPhase.Success
                onFinished(true)
            }.onFailure { error ->
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = userMessage(error)
                onFinished(false)
            }
            loading = false
        }
    }

    private suspend fun claimDeviceWhenOnline(deviceName: String, serialNumber: String? = null) {
        delay(CLAIM_INITIAL_DELAY_MS)
        repeat(CLAIM_RETRY_COUNT) { attempt ->
            bleProvisionPhase = BleProvisionPhase.LinkingAccount
            runCatching {
                api.claimDevice(deviceName, serialNumber)
                return
            }.onFailure { error ->
                if (isClaimRetryable(error) && attempt < CLAIM_RETRY_COUNT - 1) {
                    delay(CLAIM_RETRY_DELAY_MS)
                } else {
                    throw error
                }
            }
        }
    }

    private fun isClaimRetryable(error: Throwable): Boolean {
        val msg = error.message?.lowercase().orEmpty()
        if (msg.contains("déjà") || msg.contains("deja") || msg.contains("already")) return false
        if (error is ApiException && error.status == 400) {
            if (msg.contains("enregistr")) return true
            if (msg.contains("device not found")) return true
        }
        return msg.contains("device not found") || msg.contains("pas encore enregistr")
    }

    private fun bleConnectError(error: Throwable): String {
        val raw = error.message?.lowercase().orEmpty()
        return when {
            raw.contains("device not found") || raw.contains("scan again") ->
                "Boîte Bluetooth introuvable. Relance une recherche et reste proche de la boîte."
            raw.contains("not connected") || raw.contains("disconnect") ->
                "Connexion Bluetooth perdue. Vérifie que la boîte est en mode configuration."
            else -> userMessage(error)
        }
    }

    private companion object {
        const val CLAIM_RETRY_COUNT = 24
        const val CLAIM_RETRY_DELAY_MS = 3_000L
        const val CLAIM_INITIAL_DELAY_MS = 2_000L
    }

    fun retryClaimAfterProvision(onFinished: (success: Boolean) -> Unit) {
        val name = bleProvisionDeviceName?.trim().orEmpty()
        if (name.isBlank()) {
            bleProvisionError = "Nom de boîte manquant"
            onFinished(false)
            return
        }
        scope.launch {
            loading = true
            bleProvisionError = null
            bleProvisionPhase = BleProvisionPhase.LinkingAccount
            runCatching {
                claimDeviceWhenOnline(name, bleProvisionSerialNumber)
                loadRemoteState()
                bleProvisionPhase = BleProvisionPhase.Success
                onFinished(true)
            }.onFailure { error ->
                bleProvisionPhase = BleProvisionPhase.Failed
                bleProvisionError = userMessage(error)
                onFinished(false)
            }
            loading = false
        }
    }

    fun claimDevice(onDone: () -> Unit) {
        scope.launch {
            loading = true
            runCatching {
                api.claimDevice(claimDeviceName.trim())
                loadRemoteState()
                snackbarMessage = "Boîte liée au compte"
                onDone()
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun createInvite() {
        scope.launch {
            loading = true
            runCatching {
                inviteUrl = api.createInvite().url
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun requestPairing() {
        scope.launch {
            loading = true
            runCatching {
                api.requestPairing(
                    deviceName = pairDeviceName.trim().ifBlank { null },
                    uuid = null,
                )
                snackbarMessage = "Demande envoyée"
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun acceptPairing(pairingId: Long) {
        scope.launch {
            loading = true
            runCatching {
                api.acceptPairing(pairingId)
                refreshState()
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun rejectPairing(pairingId: Long) {
        scope.launch {
            runCatching {
                api.rejectPairing(pairingId)
                refreshState()
            }.onFailure { snackbarMessage = userMessage(it) }
        }
    }

    fun acceptInviteToken(token: String) {
        scope.launch {
            loading = true
            runCatching {
                api.acceptInvite(token)
                refreshState()
                snackbarMessage = "Boîte partenaire liée"
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun sendMessage(onSent: () -> Unit) {
        val target = linkedTarget ?: run {
            snackbarMessage = "Aucune boîte liée"
            return
        }
        scope.launch {
            loading = true
            runCatching {
                val bacm = BacMessagePack.buildFromScene(composerScene, rasterizer) { ref, size ->
                    EmojiFrameLoader.loadFrames(ref, size)
                }
                api.sendMessage(target.deviceId, bacm)
                snackbarMessage = "Message envoyé"
                onSent()
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun loadHistory() {
        scope.launch {
            loading = true
            runCatching {
                history = api.listSentMessages().items
            }.onFailure { snackbarMessage = userMessage(it) }
            loading = false
        }
    }

    fun updateDeviceName(name: String) {
        scope.launch {
            runCatching {
                myDevice = api.updateDevice(deviceName = name, regionOverride = null).device
            }.onFailure { snackbarMessage = userMessage(it) }
        }
    }

    fun updateRegion(region: String) {
        scope.launch {
            runCatching {
                myDevice = api.updateDevice(deviceName = null, regionOverride = region).device
            }.onFailure { snackbarMessage = userMessage(it) }
        }
    }
}
