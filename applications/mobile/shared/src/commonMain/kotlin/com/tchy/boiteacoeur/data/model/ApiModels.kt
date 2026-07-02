package com.tchy.boiteacoeur.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AuthResponse(
    val ok: Boolean = true,
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Int,
    val user: UserDto,
)

@Serializable
data class UserDto(
    val id: Long,
    val email: String,
)

@Serializable
data class ApiError(
    val ok: Boolean = false,
    val error: String,
)

@Serializable
data class DeviceDto(
    val id: Long,
    val uuid: String,
    @SerialName("device_name") val deviceName: String,
    @SerialName("serial_number") val serialNumber: String = "",
    val region: String? = null,
    @SerialName("firmware_version") val firmwareVersion: String? = null,
    @SerialName("last_seen_at") val lastSeenAt: String? = null,
    val online: Boolean = false,
)

@Serializable
data class DeviceMeResponse(
    val ok: Boolean = true,
    val device: DeviceDto? = null,
)

@Serializable
data class PairingStateResponse(
    val ok: Boolean = true,
    @SerialName("owned_device") val ownedDevice: OwnedDeviceDto? = null,
    @SerialName("linked_target") val linkedTarget: LinkedTargetDto? = null,
    @SerialName("pending_requests") val pendingRequests: List<PendingRequestDto> = emptyList(),
)

@Serializable
data class OwnedDeviceDto(
    val id: Long,
    @SerialName("device_name") val deviceName: String,
    val uuid: String,
)

@Serializable
data class LinkedTargetDto(
    @SerialName("pairing_id") val pairingId: Long,
    @SerialName("device_id") val deviceId: Long,
    @SerialName("device_name") val deviceName: String,
    val uuid: String,
)

@Serializable
data class PendingRequestDto(
    @SerialName("request_id") val requestId: Long,
    @SerialName("pairing_id") val pairingId: Long,
    @SerialName("from_email") val fromEmail: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class InviteResponse(
    val ok: Boolean = true,
    val token: String,
    val url: String,
    @SerialName("deep_link") val deepLink: String,
    @SerialName("expires_at") val expiresAt: String,
)

@Serializable
data class SentMessagesResponse(
    val ok: Boolean = true,
    val items: List<SentMessageDto> = emptyList(),
    val page: Int = 1,
)

@Serializable
data class SentMessageDto(
    val id: Long,
    @SerialName("message_id") val messageId: Long,
    @SerialName("target_device_name") val targetDeviceName: String,
    @SerialName("preview_base64") val previewBase64: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class SendMessageResponse(
    val ok: Boolean = true,
    @SerialName("message_id") val messageId: Long,
)
