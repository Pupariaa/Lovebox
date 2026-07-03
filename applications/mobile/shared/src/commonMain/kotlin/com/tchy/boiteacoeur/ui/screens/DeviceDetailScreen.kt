package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.theme.WineAccent
import com.tchy.boiteacoeur.ui.util.deviceLabel
import com.tchy.boiteacoeur.ui.util.formatLastSeen
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun DeviceDetailScreen(
    vm: AppViewModel,
    deviceId: Long,
    onBack: () -> Unit,
) {
    val device = vm.devices.find { it.id == deviceId } ?: vm.myDevice

    AppScaffold(title = "Ma boîte", onBack = onBack) { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (device == null) {
                Text("Aucune boîte associée", color = MaterialTheme.colorScheme.onSurfaceVariant)
                return@Column
            }

            DetailRow("Nom affiché", deviceLabel(device))
            DetailRow("Nom usine", device.deviceName)
            DetailRow("Série", device.serialNumber.ifBlank { "—" })
            DetailRow("Région", device.region?.ifBlank { "Automatique" } ?: "Automatique")
            DetailRow(
                "Statut",
                formatLastSeen(device.online, device.lastSeenSecondsAgo),
            )
            device.firmwareVersion?.let { DetailRow("Firmware", it) }

            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Retour")
            }

            Button(
                onClick = { vm.unclaimDevice(device.id, onBack) },
                enabled = !vm.loading,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = WineAccent),
            ) {
                Text("Dissocier cette boîte")
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = RosePrimary,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
