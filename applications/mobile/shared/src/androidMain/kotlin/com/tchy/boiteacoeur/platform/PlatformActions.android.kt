package com.tchy.boiteacoeur.platform

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri

actual fun copyToClipboard(text: String) {
    val clipboard = PlatformContext.appContext.getSystemService(ClipboardManager::class.java)
    clipboard.setPrimaryClip(ClipData.newPlainText("code", text))
}

actual fun openUrl(url: String) {
    val intent = Intent(Intent.ACTION_VIEW, url.toUri()).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    PlatformContext.appContext.startActivity(intent)
}
