package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.NavMenuGroup
import com.tchy.boiteacoeur.ui.components.NavMenuItem
import com.tchy.boiteacoeur.ui.components.TabScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.theme.WineAccent
import com.tchy.boiteacoeur.ui.util.deviceLabel
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun AccountHubScreen(
    vm: AppViewModel,
    onProfile: () -> Unit,
    onSettings: () -> Unit,
    onDeviceDetail: (Long) -> Unit,
    onHistory: () -> Unit,
    onBle: () -> Unit,
    onLegal: () -> Unit,
    onLogout: () -> Unit,
) {
    LaunchedEffect(Unit) {
        vm.loadUserProfile()
        vm.loadHistory()
        vm.refreshState()
    }

    val device = vm.myDevice
    val profileName = listOfNotNull(
        vm.userProfile?.firstName?.trim()?.takeIf { it.isNotEmpty() },
        vm.userProfile?.lastName?.trim()?.takeIf { it.isNotEmpty() },
    ).joinToString(" ").ifBlank { vm.userProfile?.email ?: "Mon compte" }

    TabScaffold(title = "Compte") { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = profileName,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = vm.userProfile?.email ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            NavMenuGroup {
                NavMenuItem(
                    title = "Mon profil",
                    subtitle = "Nom, langue, mot de passe",
                    icon = Icons.Default.Person,
                    showDivider = false,
                    onClick = onProfile,
                )
                NavMenuItem(
                    title = "Réglages de la boîte",
                    subtitle = device?.let { deviceLabel(it) } ?: "Aucune boîte liée",
                    icon = Icons.Default.Settings,
                    onClick = onSettings,
                )
                device?.let {
                    NavMenuItem(
                        title = "Détails de la boîte",
                        subtitle = it.serialNumber.ifBlank { "Série inconnue" },
                        icon = Icons.Default.Wifi,
                        onClick = { onDeviceDetail(it.id) },
                    )
                }
                NavMenuItem(
                    title = "Historique des envois",
                    subtitle = "${vm.history.size} message(s)",
                    icon = Icons.Default.History,
                    onClick = onHistory,
                )
                NavMenuItem(
                    title = "Configurer le WiFi",
                    subtitle = "Bluetooth et association",
                    icon = Icons.Default.Bluetooth,
                    onClick = onBle,
                )
            }

            NavMenuGroup {
                NavMenuItem(
                    title = "Informations légales",
                    subtitle = "CGU, confidentialité, mentions",
                    icon = Icons.Default.Gavel,
                    showDivider = false,
                    onClick = onLegal,
                )
            }

            Spacer(Modifier.weight(1f))

            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = WineAccent),
            ) {
                Text("Déconnexion")
            }
        }
    }
}
