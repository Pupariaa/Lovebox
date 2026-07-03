package com.tchy.boiteacoeur.ui.screens

import androidx.compose.runtime.Composable
import com.tchy.boiteacoeur.ui.components.TabScaffold
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun ContactsTabScreen(vm: AppViewModel) {
    TabScaffold(title = "Contacts") { modifier ->
        PairingContent(vm = vm, modifier = modifier)
    }
}
