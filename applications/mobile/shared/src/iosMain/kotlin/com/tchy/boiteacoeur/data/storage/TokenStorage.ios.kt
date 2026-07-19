package com.tchy.boiteacoeur.data.storage

import com.russhwolf.settings.ExperimentalSettingsImplementation
import com.russhwolf.settings.KeychainSettings
import com.russhwolf.settings.Settings

@OptIn(ExperimentalSettingsImplementation::class)
actual class TokenStorage actual constructor() {
    private val settings: Settings = KeychainSettings(service = KEYCHAIN_SERVICE)

    actual fun getAccessToken(): String? = settings.readToken(KEY_ACCESS)
    actual fun setAccessToken(token: String?) {
        if (token == null) settings.remove(KEY_ACCESS) else settings.putString(KEY_ACCESS, token)
    }

    actual fun getRefreshToken(): String? = settings.readToken(KEY_REFRESH)
    actual fun setRefreshToken(token: String?) {
        if (token == null) settings.remove(KEY_REFRESH) else settings.putString(KEY_REFRESH, token)
    }

    actual fun clear() {
        settings.remove(KEY_ACCESS)
        settings.remove(KEY_REFRESH)
    }

    private companion object {
        const val KEYCHAIN_SERVICE = "com.tchy.boiteacoeur.tokens"
        const val KEY_ACCESS = "access"
        const val KEY_REFRESH = "refresh"
    }
}

private fun Settings.readToken(key: String): String? =
    if (hasKey(key)) getString(key, "") else null
