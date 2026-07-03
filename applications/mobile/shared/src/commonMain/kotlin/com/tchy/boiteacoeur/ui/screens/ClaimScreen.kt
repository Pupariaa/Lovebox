package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun ClaimScreen(vm: AppViewModel, onDone: () -> Unit) {
    AppScaffold(title = "Lier ma boîte", onBack = onDone) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Entre l'identifiant et le numéro de série lus sur l'écran de ta boîte ou via Bluetooth.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = vm.claimUuid,
                onValueChange = { vm.claimUuid = it.filter { c -> c.isDigit() }.take(128) },
                label = { Text("UUID (128 chiffres)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = vm.claimSerialNumber,
                onValueChange = { vm.claimSerialNumber = it },
                label = { Text("Numéro de série") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = { vm.claimDevice(onDone) },
                enabled = vm.claimUuid.length == 128 && vm.claimSerialNumber.isNotBlank() && !vm.loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text(
                    "Associer à mon compte",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
