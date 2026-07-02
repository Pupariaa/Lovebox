package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun SettingsScreen(vm: AppViewModel, onBack: () -> Unit) {
    var deviceName by remember(vm.myDevice) { mutableStateOf(vm.myDevice?.deviceName ?: "") }
    var region by remember(vm.myDevice) { mutableStateOf(vm.myDevice?.region ?: "") }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Réglages")
        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            label = { Text("Nom de la boîte") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        )
        Button(onClick = { vm.updateDeviceName(deviceName) }, modifier = Modifier.fillMaxWidth()) {
            Text("Enregistrer le nom")
        }
        OutlinedTextField(
            value = region,
            onValueChange = { region = it },
            label = { Text("Région (override)") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        )
        Button(onClick = { vm.updateRegion(region) }, modifier = Modifier.fillMaxWidth()) {
            Text("Enregistrer la région")
        }
        Button(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
            Text("Retour")
        }
    }
}
