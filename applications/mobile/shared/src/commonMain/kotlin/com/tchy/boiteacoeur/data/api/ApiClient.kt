package com.tchy.boiteacoeur.data.api

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.ApiError
import com.tchy.boiteacoeur.data.model.AuthResponse
import com.tchy.boiteacoeur.data.model.DeviceMeResponse
import com.tchy.boiteacoeur.data.model.DeviceUpdateResponse
import com.tchy.boiteacoeur.data.model.PairingCodeResponse
import com.tchy.boiteacoeur.data.model.PairingStateResponse
import com.tchy.boiteacoeur.data.model.SendMessageResponse
import com.tchy.boiteacoeur.data.model.SentMessagesResponse
import com.tchy.boiteacoeur.data.model.UserProfileDto
import com.tchy.boiteacoeur.data.model.UserProfileResponse
import com.tchy.boiteacoeur.data.storage.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

expect fun createHttpClient(): HttpClient

class ApiClient(private val tokens: TokenStorage) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val client = createHttpClient().config {
        install(ContentNegotiation) { json(json) }
    }

    suspend fun register(email: String, password: String): AuthResponse =
        postAuth("/api/v1/auth/register", email.trim(), password)

    suspend fun login(email: String, password: String): AuthResponse =
        postAuth("/api/v1/auth/login", email.trim(), password)

    suspend fun refresh(): AuthResponse {
        val refresh = tokens.getRefreshToken() ?: throw ApiException("Session expirée", 401)
        val response = client.post("${AppConfig.API_BASE}/api/v1/auth/refresh") {
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("refresh_token", refresh) })
        }
        return parseAuth(response.requireSuccess().body())
    }

    suspend fun logout() {
        val refresh = tokens.getRefreshToken()
        if (refresh != null) {
            runCatching {
                client.post("${AppConfig.API_BASE}/api/v1/auth/logout") {
                    contentType(ContentType.Application.Json)
                    setBody(buildJsonObject { put("refresh_token", refresh) })
                }
            }
        }
        clearLocalSession()
    }

    fun clearLocalSession() {
        tokens.clear()
    }

    suspend fun claimDevice(uuid: String, serialNumber: String): DeviceUpdateResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/devices/claim") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    put("uuid", uuid.trim())
                    put("serial_number", serialNumber.trim())
                })
            }.bodyOrThrow()
        }

    suspend fun getMyDevice(): DeviceMeResponse =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/devices/me") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    suspend fun updateDevice(
        deviceId: Long,
        displayName: String?,
        regionOverride: String?,
    ): DeviceUpdateResponse =
        authRequest { token ->
            client.patch("${AppConfig.API_BASE}/api/v1/devices/$deviceId") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    displayName?.let { put("display_name", it) }
                    regionOverride?.let { put("region_override", it) }
                })
            }.bodyOrThrow()
        }

    suspend fun unclaimDevice(deviceId: Long) {
        authRequest { token ->
            client.delete("${AppConfig.API_BASE}/api/v1/devices/$deviceId/claim") {
                header("Authorization", "Bearer $token")
            }.requireSuccess()
        }
    }

    suspend fun getPairingState(): PairingStateResponse =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/pairings/me") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    suspend fun generatePairingCode(deviceId: Long? = null): PairingCodeResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/code/generate") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                if (deviceId != null) {
                    setBody(buildJsonObject { put("device_id", deviceId) })
                }
            }.bodyOrThrow()
        }

    suspend fun acceptPairingCode(code: String, deviceId: Long? = null): PairingStateResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/code/accept") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    put("code", code.trim())
                    deviceId?.let { put("device_id", it) }
                })
            }.bodyOrThrow()
        }

    suspend fun unlinkPairing(pairingId: Long) {
        authRequest { token ->
            client.delete("${AppConfig.API_BASE}/api/v1/pairings/$pairingId") {
                header("Authorization", "Bearer $token")
            }.requireSuccess()
        }
    }

    suspend fun getUserProfile(): UserProfileDto =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/users/me") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow<UserProfileResponse>().user
        }

    suspend fun updateUserProfile(
        firstName: String? = null,
        lastName: String? = null,
        locale: String? = null,
        password: String? = null,
    ): UserProfileDto =
        authRequest { token ->
            client.patch("${AppConfig.API_BASE}/api/v1/users/me") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    firstName?.let { put("first_name", it) }
                    lastName?.let { put("last_name", it) }
                    locale?.let { put("locale", it) }
                    password?.let { put("password", it) }
                })
            }.bodyOrThrow<UserProfileResponse>().user
        }

    suspend fun sendMessage(
        targetDeviceId: Long,
        bacm: ByteArray,
        scheduledAt: String? = null,
    ): SendMessageResponse =
        authRequest { token ->
            val query = buildString {
                append("target_device_id=$targetDeviceId")
                if (!scheduledAt.isNullOrBlank()) {
                    append("&scheduled_at=${scheduledAt.trim()}")
                }
            }
            client.post("${AppConfig.API_BASE}/api/v1/messages?$query") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.OctetStream)
                setBody(bacm)
            }.bodyOrThrow()
        }

    suspend fun listSentMessages(page: Int = 1): SentMessagesResponse =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/messages/sent?page=$page") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    private suspend fun postAuth(path: String, email: String, password: String): AuthResponse {
        val response = client.post("${AppConfig.API_BASE}$path") {
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("email", email)
                put("password", password)
            })
        }
        return parseAuth(response.requireSuccess().body())
    }

    private fun parseAuth(body: AuthResponse): AuthResponse {
        tokens.setAccessToken(body.accessToken)
        tokens.setRefreshToken(body.refreshToken)
        return body
    }

    private suspend fun <T> authRequest(block: suspend (String) -> T): T {
        var token = tokens.getAccessToken() ?: throw ApiException("Non connecté", 401)
        return try {
            block(token)
        } catch (e: ApiException) {
            if (e.status != 401) throw e
            try {
                refresh()
            } catch (refreshError: ApiException) {
                clearLocalSession()
                throw refreshError
            }
            token = tokens.getAccessToken() ?: throw ApiException("Session expirée", 401)
            block(token)
        }
    }

    private suspend fun HttpResponse.requireSuccess(): HttpResponse {
        if (status.value !in 200..299) {
            throw ApiException(parseApiErrorMessage(bodyAsText()), status.value)
        }
        return this
    }
}

class ApiException(message: String, val status: Int = 0) : Exception(message)

private val apiJson = Json { ignoreUnknownKeys = true; isLenient = true }

fun parseApiErrorMessage(text: String): String {
    val raw = try {
        apiJson.decodeFromString<ApiError>(text).error
    } catch (_: Exception) {
        text.trim()
    }
    return mapApiError(raw)
}

fun mapApiError(message: String): String = when {
    message.contains("device not found", ignoreCase = true) ->
        "La boîte n'est pas encore enregistrée sur le serveur. Attends une minute puis réessaie l'association."
    message.contains("invalid uuid", ignoreCase = true) ->
        "Identifiant de boîte invalide"
    message.contains("invalid serial", ignoreCase = true) ->
        "Numéro de série invalide"
    message.contains("serial_number mismatch", ignoreCase = true) ->
        "Le numéro de série ne correspond pas à la boîte"
    message.contains("invalid device name", ignoreCase = true) ->
        "Nom de boîte invalide"
    message.contains("user already owns a device", ignoreCase = true) ->
        "Tu as déjà une boîte liée à ce compte. Déconnecte-la d'abord ou utilise un autre compte."
    message.contains("device already claimed", ignoreCase = true) ->
        "Cette boîte est déjà associée à un compte"
    message.contains("invalid or expired code", ignoreCase = true) ->
        "Code invalide ou expiré"
    message.contains("invalid code", ignoreCase = true) ->
        "Code invalide"
    message.contains("invalid credentials", ignoreCase = true) ->
        "Email ou mot de passe incorrect"
    message.contains("email already registered", ignoreCase = true) ->
        "Cet email est déjà utilisé"
    message.contains("invalid email", ignoreCase = true) ->
        "Adresse email invalide"
    message.contains("password too short", ignoreCase = true) ->
        "Mot de passe trop court (8 caractères minimum)"
    message.contains("missing token", ignoreCase = true) ||
        message.contains("invalid token", ignoreCase = true) ||
        message.contains("invalid refresh token", ignoreCase = true) ->
        "Session expirée, reconnecte-toi"
    else -> message
}

suspend inline fun <reified T> HttpResponse.bodyOrThrow(): T {
    if (status.value !in 200..299) {
        throw ApiException(parseApiErrorMessage(bodyAsText()), status.value)
    }
    return body()
}
