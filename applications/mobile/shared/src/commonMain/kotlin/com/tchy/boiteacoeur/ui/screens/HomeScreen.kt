package com.tchy.boiteacoeur.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.platform.rememberBluetoothPermissionRequester
import com.tchy.boiteacoeur.ui.components.TabScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.util.deviceLabel
import com.tchy.boiteacoeur.ui.util.formatLastSeen
import com.tchy.boiteacoeur.ui.util.targetLabel
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun HomeScreen(
    vm: AppViewModel,
    onBle: () -> Unit,
    onGoContacts: () -> Unit,
    onGoCompose: () -> Unit,
    onDeviceDetail: (Long) -> Unit,
) {
    LaunchedEffect(Unit) {
        vm.refreshState()
        vm.loadHistory()
        vm.loadUserProfile()
    }

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val device = vm.myDevice
    val hasContacts = vm.linkedTargets.isNotEmpty()
    val greeting = vm.userProfile?.firstName?.trim()?.takeIf { it.isNotEmpty() } ?: "Bienvenue"

    val requestBlePermissions = rememberBluetoothPermissionRequester { granted ->
        if (granted) onBle()
        else vm.showSnackbar("Autorise le Bluetooth pour configurer ta boîte")
    }

    TabScaffold(title = "Accueil") { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(400))) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = greeting,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Ton espace Boîte à Cœur",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (device == null) {
                OnboardingCard(onBle = { requestBlePermissions() })
            } else {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.large,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
                    onClick = { onDeviceDetail(device.id) },
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Ma boîte", style = MaterialTheme.typography.labelLarge, color = RosePrimary)
                        Text(deviceLabel(device), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            formatLastSeen(device.online, device.lastSeenSecondsAgo),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (device.online) RosePrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (hasContacts) {
                    val target = vm.selectedTarget ?: vm.linkedTargets.first()
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.large,
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
                        onClick = onGoCompose,
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Prochain message pour", style = MaterialTheme.typography.labelLarge, color = RosePrimary)
                            Text(targetLabel(target), style = MaterialTheme.typography.titleMedium)
                            Text(
                                "Ouvre l'onglet Écrire pour composer",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                } else {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.large,
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
                        onClick = onGoContacts,
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Aucun contact lié", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Text(
                                "Va dans Contacts pour générer ou saisir un code de liaison.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Button(
                                onClick = onGoContacts,
                                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
                            ) {
                                Text("Lier un contact")
                            }
                        }
                    }
                }

                vm.history.firstOrNull()?.let { last ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.7f),
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Dernier envoi", style = MaterialTheme.typography.labelMedium, color = RosePrimary)
                            Text("Vers ${last.targetDeviceName}", style = MaterialTheme.typography.bodyMedium)
                            Text(last.createdAt, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            if (vm.refreshing) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                    color = RosePrimary,
                    strokeWidth = 2.dp,
                )
            }
        }
    }
}

@Composable
private fun OnboardingCard(onBle: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Configure ta boîte", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "Connecte-la au WiFi via Bluetooth. Elle sera associée à ton compte.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = onBle,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Configurer ma boîte")
            }
        }
    }
}
