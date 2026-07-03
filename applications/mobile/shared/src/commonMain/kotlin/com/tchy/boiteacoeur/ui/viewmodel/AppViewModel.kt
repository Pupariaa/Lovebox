package com.tchy.boiteacoeur.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
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
import com.tchy.boiteacoeur.data.model.SentMessageDto
import com.tchy.boiteacoeur.data.model.UserProfileDto
import com.tchy.boiteacoeur.data.storage.TokenStorage
import com.tchy.boiteacoeur.domain.bacm.BacMessagePack
import com.tchy.boiteacoeur.domain.bacm.EmojiFrameLoader
import com.tchy.boiteacoeur.domain.bacm.SceneRasterizer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

    private val _snackbarMessage = MutableStateFlow<String?>(null)
    val snackbarMessage: StateFlow<String?> = _snackbarMessage.asStateFlow()

    var devices by mutableStateOf<List<DeviceDto>>(emptyList())
    var myDevice by mutableStateOf<DeviceDto?>(null)
    var selectedDeviceId by mutableLongStateOf(0L)
    var ownedDevices by mutableStateOf<List<OwnedDeviceDto>>(emptyList())
    var ownedDevice by mutableStateOf<OwnedDeviceDto?>(null)
    var linkedTargets by mutableStateOf<List<LinkedTargetDto>>(emptyList())
    var linkedTarget by mutableStateOf<LinkedTargetDto?>(null)
    var selectedTarget by mutableStateOf<LinkedTargetDto?>(null)
    var userProfile by mutableStateOf<UserProfileDto?>(null)

    var pairingCode by mutableStateOf<String?>(null)
    var pairingCodeCopied by mutableStateOf(false)

    var bleDevices by mutableStateOf<List<BleDeviceItem>>(emptyList())
    var bleProvisionPhase by mutableStateOf(BleProvisionPhase.Idle)
    var bleProvisionError by mutableStateOf<String?>(null)
    var bleProvisionDeviceName by mutableStateOf<String?>(null)
    var bleProvisionSerialNumber by mutableStateOf<String?>(null)
    var bleProvisionUuid by mutableStateOf<String?>(null)
    var bleWifiProvisioned by mutableStateOf(false)
    var claimUuid by mutableStateOf("")
    var claimSerialNumber by mutableStateOf("")

    var composerScene by mutableStateOf(BacMessagePack.createDefaultScene())
    var scheduledSendAt by mutableStateOf("")
    var history by mutableStateOf<List<SentMessageDto>>(emptyList())

    var forceAuth by mutableStateOf(false)

    fun clearSnackbar() {
        _snackbarMessage.value = null
    }

    private fun showMessage(message: String) {
        _snackbarMessage.value = message
    }

    fun showSnackbar(message: String) {
        showMessage(message)
    }

    private fun clearSession() {
        api.clearLocalSession()
        isLoggedIn = false
        devices = emptyList()
        myDevice = null
        selectedDeviceId = 0L
        ownedDevices = emptyList()
        ownedDevice = null
        linkedTargets = emptyList()
        linkedTarget = null
        selectedTarget = null
        userProfile = null
        pairingCode = null
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
        val deviceResponse = api.getMyDevice()
        devices = deviceResponse.devices
        myDevice = deviceResponse.device ?: devices.firstOrNull()
        if (selectedDeviceId == 0L || devices.none { it.id == selectedDeviceId }) {
            selectedDeviceId = myDevice?.id ?: 0L
        }
        myDevice = devices.find { it.id == selectedDeviceId } ?: devices.firstOrNull()

        val pairing = api.getPairingState()
        ownedDevices = pairing.ownedDevices
        ownedDevice = pairing.ownedDevice ?: ownedDevices.firstOrNull()
        linkedTargets = pairing.linkedTargets
        linkedTarget = pairing.linkedTarget ?: linkedTargets.firstOrNull()
        if (selectedTarget == null || linkedTargets.none { it.deviceId == selectedTarget?.deviceId }) {
            selectedTarget = linkedTarget
        } else {
            selectedTarget = linkedTargets.find { it.deviceId == selectedTarget?.deviceId }
        }

        userProfile = runCatching { api.getUserProfile() }.getOrNull()
    }

    fun selectDevice(deviceId: Long) {
        selectedDeviceId = deviceId
        myDevice = devices.find { it.id == deviceId }
    }

    fun selectTarget(target: LinkedTargetDto) {
        selectedTarget = target
    }

    fun login(email: String, password: String, onSuccess: () -> Unit) {
        scope.launch {
            loading = true
            runCatching { api.login(email, password) }
                .onSuccess {
                    isLoggedIn = true
                    runCatching { loadRemoteState() }
                        .onFailure { showMessage(userMessage(it)) }
                    onSuccess()
                }
                .onFailure { showMessage(userMessage(it)) }
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
                        .onFailure { showMessage(userMessage(it)) }
                    onSuccess()
                }
                .onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun logout() {
        scope.launch {
            runCatching { api.logout() }
            clearSession()
            isLoggedIn = false
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
                        showMessage(userMessage(error))
                    }
                }
            loading = false
        }
    }

    fun scanBle() {
        scope.launch {
            loading = true
            runCatching { bleDevices = ble.scan() }
                .onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun resetBleProvision() {
        bleProvisionPhase = BleProvisionPhase.Idle
        bleProvisionError = null
        bleWifiProvisioned = false
        bleProvisionSerialNumber = null
        bleProvisionUuid = null
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
            bleProvisionUuid = identity?.uuid?.trim()?.takeIf { it.isNotBlank() }

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
                    uuid = bleProvisionUuid.orEmpty(),
                    serialNumber = bleProvisionSerialNumber.orEmpty(),
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

    private suspend fun claimDeviceWhenOnline(uuid: String, serialNumber: String) {
        if (uuid.length != 128 || !uuid.all { it.isDigit() }) {
            throw ApiException("Identifiant de boîte invalide", 400)
        }
        if (serialNumber.isBlank()) {
            throw ApiException("Numéro de série manquant", 400)
        }
        delay(CLAIM_INITIAL_DELAY_MS)
        repeat(CLAIM_RETRY_COUNT) { attempt ->
            bleProvisionPhase = BleProvisionPhase.LinkingAccount
            runCatching {
                api.claimDevice(uuid, serialNumber)
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
        val uuid = bleProvisionUuid?.trim().orEmpty()
        val serial = bleProvisionSerialNumber?.trim().orEmpty()
        if (uuid.isBlank() || serial.isBlank()) {
            bleProvisionError = "Identité de boîte incomplète"
            onFinished(false)
            return
        }
        scope.launch {
            loading = true
            bleProvisionError = null
            bleProvisionPhase = BleProvisionPhase.LinkingAccount
            runCatching {
                claimDeviceWhenOnline(uuid, serial)
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
                api.claimDevice(claimUuid.trim(), claimSerialNumber.trim())
                loadRemoteState()
                showMessage("Boîte liée au compte")
                onDone()
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun generatePairingCode() {
        scope.launch {
            loading = true
            pairingCodeCopied = false
            runCatching {
                val deviceId = if (devices.size > 1) selectedDeviceId.takeIf { it > 0 } else null
                pairingCode = api.generatePairingCode(deviceId).code
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun markPairingCodeCopied() {
        pairingCodeCopied = true
        showMessage("Code copié")
    }

    fun acceptPairingCode(code: String) {
        scope.launch {
            loading = true
            runCatching {
                val deviceId = if (devices.size > 1) selectedDeviceId.takeIf { it > 0 } else null
                api.acceptPairingCode(code, deviceId)
                loadRemoteState()
                showMessage("Contact lié")
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun unlinkTarget(pairingId: Long) {
        scope.launch {
            loading = true
            runCatching {
                api.unlinkPairing(pairingId)
                loadRemoteState()
                showMessage("Contact retiré")
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun unclaimDevice(deviceId: Long, onDone: () -> Unit) {
        scope.launch {
            loading = true
            runCatching {
                api.unclaimDevice(deviceId)
                loadRemoteState()
                showMessage("Boîte dissociée")
                onDone()
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun sendMessage(onSent: () -> Unit) {
        val target = selectedTarget ?: linkedTarget ?: run {
            showMessage("Aucun contact lié")
            return
        }
        scope.launch {
            loading = true
            runCatching {
                val bacm = BacMessagePack.buildFromScene(composerScene, rasterizer) { ref, size ->
                    EmojiFrameLoader.loadFrames(ref, size)
                }
                val scheduled = scheduledSendAt.trim().ifBlank { null }
                api.sendMessage(target.deviceId, bacm, scheduled)
                showMessage("Message envoyé")
                onSent()
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun loadHistory() {
        scope.launch {
            loading = true
            runCatching {
                history = api.listSentMessages().items
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    fun updateDeviceSettings(displayName: String, regionOverride: String) {
        val deviceId = selectedDeviceId.takeIf { it > 0 } ?: myDevice?.id ?: return
        scope.launch {
            loading = true
            runCatching {
                val response = api.updateDevice(
                    deviceId = deviceId,
                    displayName = displayName.trim(),
                    regionOverride = regionOverride.trim().ifBlank { "" },
                )
                response.device?.let { updated ->
                    devices = devices.map { if (it.id == updated.id) updated else it }
                    if (myDevice?.id == updated.id) myDevice = updated
                }
                pushDeviceConfigViaBle(displayName.trim(), regionOverride.trim())
                showMessage("Réglages enregistrés")
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }

    private suspend fun pushDeviceConfigViaBle(displayName: String, region: String) {
        val locale = userProfile?.locale?.ifBlank { "fr" } ?: "fr"
        val deviceName = myDevice?.deviceName ?: bleProvisionDeviceName ?: return
        withContext(Dispatchers.IO) {
            runCatching {
                val candidates = ble.scan(6_000)
                val match = candidates.firstOrNull {
                    it.name.equals(deviceName, ignoreCase = true) ||
                        it.name.equals(displayName, ignoreCase = true)
                } ?: return@runCatching
                ble.connect(match.address, match.name)
                ble.sendDeviceConfig(displayName, locale, region)
                ble.disconnect()
            }
        }
    }

    fun loadUserProfile() {
        scope.launch {
            runCatching {
                userProfile = api.getUserProfile()
            }.onFailure { showMessage(userMessage(it)) }
        }
    }

    fun updateUserProfile(
        firstName: String?,
        lastName: String?,
        locale: String?,
        password: String?,
        onDone: () -> Unit = {},
    ) {
        scope.launch {
            loading = true
            runCatching {
                userProfile = api.updateUserProfile(firstName, lastName, locale, password)
                showMessage("Profil mis à jour")
                onDone()
            }.onFailure { showMessage(userMessage(it)) }
            loading = false
        }
    }
}
