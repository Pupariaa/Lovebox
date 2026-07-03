package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.platform.copyToClipboard
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.util.formatLastSeen
import com.tchy.boiteacoeur.ui.util.targetLabel
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun PairingContent(vm: AppViewModel, modifier: Modifier = Modifier) {
    var acceptCode by remember { mutableStateOf("") }

    Column(
        modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Partage ton code LOVE-XXXX ou entre celui reçu pour lier une boîte.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Button(
            onClick = { vm.generatePairingCode() },
            enabled = !vm.loading,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
        ) {
            Text("Générer mon code")
        }

        vm.pairingCode?.let { code ->
            Card(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(code, style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Monospace)
                    OutlinedButton(
                        onClick = {
                            copyToClipboard(code)
                            vm.markPairingCodeCopied()
                        },
                    ) {
                        Text(if (vm.pairingCodeCopied) "Copié" else "Copier")
                    }
                }
            }
        }

        OutlinedTextField(
            value = acceptCode,
            onValueChange = { acceptCode = it.uppercase() },
            label = { Text("Code reçu") },
            placeholder = { Text("LOVE-XXXX") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Button(
            onClick = {
                vm.acceptPairingCode(acceptCode.trim())
                acceptCode = ""
            },
            enabled = acceptCode.isNotBlank() && !vm.loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Lier ce contact")
        }

        if (vm.linkedTargets.isNotEmpty()) {
            Text("Contacts liés", style = MaterialTheme.typography.titleSmall)
            vm.linkedTargets.take(3).forEach { target ->
                val selected = vm.selectedTarget?.deviceId == target.deviceId
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    color = if (selected) RosePrimary.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface,
                    onClick = { vm.selectTarget(target) },
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(targetLabel(target), style = MaterialTheme.typography.bodyMedium)
                            Text(
                                formatLastSeen(target.online, target.lastSeenSecondsAgo),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (selected) {
                            Text("Actif", color = RosePrimary, style = MaterialTheme.typography.labelMedium)
                        }
                        OutlinedButton(onClick = { vm.unlinkTarget(target.pairingId) }) {
                            Text("Retirer")
                        }
                    }
                }
            }
            if (vm.linkedTargets.size > 3) {
                Text(
                    "+${vm.linkedTargets.size - 3} autre(s)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.weight(1f))
    }
}
