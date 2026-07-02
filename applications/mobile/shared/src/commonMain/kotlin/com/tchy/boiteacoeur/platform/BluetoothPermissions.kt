package com.tchy.boiteacoeur.platform

import androidx.compose.runtime.Composable

@Composable
expect fun rememberBluetoothPermissionRequester(onResult: (Boolean) -> Unit): () -> Unit
