package com.tchy.boiteacoeur.ui.util

import com.tchy.boiteacoeur.data.model.DeviceDto
import com.tchy.boiteacoeur.data.model.LinkedTargetDto

fun deviceLabel(device: DeviceDto?): String {
    if (device == null) return "Non configurée"
    return device.displayName.ifBlank { device.deviceName }
}

fun targetLabel(target: LinkedTargetDto): String =
    target.displayName.ifBlank { target.deviceName }

fun formatLastSeen(online: Boolean, secondsAgo: Int?): String {
    if (online) return "En ligne"
    if (secondsAgo == null) return "Jamais vue"
    if (secondsAgo < 60) return "Vue il y a ${secondsAgo}s"
    if (secondsAgo < 3600) {
        val minutes = secondsAgo / 60
        return "Vue il y a $minutes min"
    }
    if (secondsAgo < 86_400) {
        val hours = secondsAgo / 3600
        return "Vue il y a $hours h"
    }
    val days = secondsAgo / 86_400
    return "Vue il y a $days j"
}

val COMMON_REGIONS = listOf(
    "" to "Automatique",
    "FR" to "France",
    "BE" to "Belgique",
    "CH" to "Suisse",
    "CA" to "Canada",
    "US" to "États-Unis",
    "GB" to "Royaume-Uni",
    "DE" to "Allemagne",
    "ES" to "Espagne",
    "IT" to "Italie",
    "PT" to "Portugal",
    "NL" to "Pays-Bas",
    "LU" to "Luxembourg",
    "MA" to "Maroc",
    "TN" to "Tunisie",
    "DZ" to "Algérie",
    "RE" to "La Réunion",
    "GP" to "Guadeloupe",
    "MQ" to "Martinique",
)
