package com.tchy.boiteacoeur.data.api

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.ApiError
import com.tchy.boiteacoeur.data.model.AuthResponse
import com.tchy.boiteacoeur.data.model.DeviceMeResponse
import com.tchy.boiteacoeur.data.model.InviteResponse
import com.tchy.boiteacoeur.data.model.PairingStateResponse
import com.tchy.boiteacoeur.data.model.SendMessageResponse
import com.tchy.boiteacoeur.data.model.SentMessagesResponse
import com.tchy.boiteacoeur.data.storage.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
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

    suspend fun claimDevice(deviceName: String, serialNumber: String? = null): DeviceMeResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/devices/claim") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    put("device_name", deviceName)
                    serialNumber?.takeIf { it.isNotBlank() }?.let { put("serial_number", it) }
                })
            }.bodyOrThrow()
        }

    suspend fun getMyDevice(): DeviceMeResponse =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/devices/me") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    suspend fun updateDevice(deviceName: String?, regionOverride: String?): DeviceMeResponse =
        authRequest { token ->
            client.patch("${AppConfig.API_BASE}/api/v1/devices/me") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    deviceName?.let { put("device_name", it) }
                    regionOverride?.let { put("region_override", it) }
                })
            }.bodyOrThrow()
        }

    suspend fun getPairingState(): PairingStateResponse =
        authRequest { token ->
            client.get("${AppConfig.API_BASE}/api/v1/pairings/me") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    suspend fun createInvite(): InviteResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/invite") {
                header("Authorization", "Bearer $token")
            }.bodyOrThrow()
        }

    suspend fun acceptInvite(token: String): PairingStateResponse =
        authRequest { access ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/accept-invite") {
                header("Authorization", "Bearer $access")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject { put("token", token) })
            }.bodyOrThrow()
        }

    suspend fun requestPairing(deviceName: String?, uuid: String?): PairingStateResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/request") {
                header("Authorization", "Bearer $token")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    deviceName?.let { put("device_name", it) }
                    uuid?.let { put("uuid", it) }
                })
            }.bodyOrThrow()
        }

    suspend fun acceptPairing(pairingId: Long) {
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/$pairingId/accept") {
                header("Authorization", "Bearer $token")
            }.requireSuccess()
        }
    }

    suspend fun rejectPairing(pairingId: Long) {
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/pairings/$pairingId/reject") {
                header("Authorization", "Bearer $token")
            }.requireSuccess()
        }
    }

    suspend fun sendMessage(targetDeviceId: Long, bacm: ByteArray): SendMessageResponse =
        authRequest { token ->
            client.post("${AppConfig.API_BASE}/api/v1/messages?target_device_id=$targetDeviceId") {
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
    message.contains("invalid device name", ignoreCase = true) ->
        "Nom de boîte invalide"
    message.contains("user already owns a device", ignoreCase = true) ->
        "Tu as déjà une boîte liée à ce compte. Déconnecte-la d'abord ou utilise un autre compte."
    message.contains("device already claimed", ignoreCase = true) ->
        "Cette boîte est déjà associée à un compte"
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
