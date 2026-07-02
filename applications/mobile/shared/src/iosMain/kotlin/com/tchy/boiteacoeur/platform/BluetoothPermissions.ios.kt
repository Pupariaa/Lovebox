package com.tchy.boiteacoeur.platform

import androidx.compose.runtime.Composable

@Composable
actual fun rememberBluetoothPermissionRequester(onResult: (Boolean) -> Unit): () -> Unit {
    return { onResult(true) }
}
