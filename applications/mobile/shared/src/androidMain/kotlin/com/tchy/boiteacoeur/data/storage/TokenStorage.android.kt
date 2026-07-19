package com.tchy.boiteacoeur.data.storage

import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.tchy.boiteacoeur.platform.PlatformContext
import java.io.IOException
import java.security.GeneralSecurityException

actual class TokenStorage actual constructor() {
    private val prefs: SharedPreferences = openSecurePreferences()

    actual fun getAccessToken(): String? = prefs.getString(KEY_ACCESS, null)

    actual fun setAccessToken(token: String?) {
        prefs.edit().apply {
            if (token == null) remove(KEY_ACCESS) else putString(KEY_ACCESS, token)
        }.apply()
    }

    actual fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH, null)

    actual fun setRefreshToken(token: String?) {
        prefs.edit().apply {
            if (token == null) remove(KEY_REFRESH) else putString(KEY_REFRESH, token)
        }.apply()
    }

    actual fun clear() {
        prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).apply()
    }

    private companion object {
        const val PREFS_FILE = "bac_secure_tokens"
        const val KEY_ACCESS = "access"
        const val KEY_REFRESH = "refresh"
    }
}

private const val SECURE_PREFS_FILE = "bac_secure_tokens"

private fun openSecurePreferences(): SharedPreferences {
    val context = PlatformContext.appContext
    val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    return try {
        buildEncryptedPreferences(context, masterKey)
    } catch (error: GeneralSecurityException) {
        context.deleteSharedPreferences(SECURE_PREFS_FILE)
        buildEncryptedPreferences(context, masterKey)
    } catch (error: IOException) {
        context.deleteSharedPreferences(SECURE_PREFS_FILE)
        buildEncryptedPreferences(context, masterKey)
    }
}

private fun buildEncryptedPreferences(
    context: android.content.Context,
    masterKey: MasterKey,
): SharedPreferences =
    EncryptedSharedPreferences.create(
        context,
        SECURE_PREFS_FILE,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
