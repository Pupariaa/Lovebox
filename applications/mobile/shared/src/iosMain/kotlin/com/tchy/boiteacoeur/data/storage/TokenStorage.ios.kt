package com.tchy.boiteacoeur.data.storage

import com.russhwolf.settings.Settings
import com.russhwolf.settings.NSUserDefaultsSettings
import platform.Foundation.NSUserDefaults

actual class TokenStorage actual constructor() {
    private val settings: Settings = NSUserDefaultsSettings(NSUserDefaults.standardUserDefaults)

    actual fun getAccessToken(): String? = settings.readToken("access")
    actual fun setAccessToken(token: String?) {
        if (token == null) settings.remove("access") else settings.putString("access", token)
    }

    actual fun getRefreshToken(): String? = settings.readToken("refresh")
    actual fun setRefreshToken(token: String?) {
        if (token == null) settings.remove("refresh") else settings.putString("refresh", token)
    }

    actual fun clear() {
        settings.remove("access")
        settings.remove("refresh")
    }
}

private fun Settings.readToken(key: String): String? =
    if (hasKey(key)) getString(key, "") else null
