package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.util.COMMON_REGIONS
import com.tchy.boiteacoeur.ui.util.deviceLabel
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: AppViewModel, onBack: () -> Unit) {
    val device = vm.myDevice
    var displayName by remember(device) {
        mutableStateOf(device?.displayName?.ifBlank { device.deviceName }.orEmpty())
    }
    var regionCode by remember(device) {
        mutableStateOf(device?.region.orEmpty())
    }
    var deviceMenuExpanded by remember { mutableStateOf(false) }

    AppScaffold(title = "Réglages", onBack = onBack) { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (vm.devices.size > 1) {
                ExposedDropdownMenuBox(
                    expanded = deviceMenuExpanded,
                    onExpandedChange = { deviceMenuExpanded = it },
                ) {
                    OutlinedTextField(
                        value = device?.let { deviceLabel(it) }.orEmpty(),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Boîte") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(deviceMenuExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = deviceMenuExpanded,
                        onDismissRequest = { deviceMenuExpanded = false },
                    ) {
                        vm.devices.forEach { item ->
                            DropdownMenuItem(
                                text = { Text(deviceLabel(item)) },
                                onClick = {
                                    vm.selectDevice(item.id)
                                    displayName = item.displayName.ifBlank { item.deviceName }
                                    regionCode = item.region.orEmpty()
                                    deviceMenuExpanded = false
                                },
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Nom affiché") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            var regionMenuExpanded by remember { mutableStateOf(false) }
            val regionLabel = COMMON_REGIONS.find { it.first == regionCode }?.second ?: regionCode.ifBlank { "Automatique" }

            ExposedDropdownMenuBox(
                expanded = regionMenuExpanded,
                onExpandedChange = { regionMenuExpanded = it },
            ) {
                OutlinedTextField(
                    value = regionLabel,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Région") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(regionMenuExpanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(
                    expanded = regionMenuExpanded,
                    onDismissRequest = { regionMenuExpanded = false },
                ) {
                    COMMON_REGIONS.forEach { (code, label) ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = {
                                regionCode = code
                                regionMenuExpanded = false
                            },
                        )
                    }
                }
            }

            Text(
                text = "Le nom et la région sont envoyés à la boîte dès que possible.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Button(
                onClick = { vm.updateDeviceSettings(displayName, regionCode) },
                enabled = !vm.deviceUpdating && device != null,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Enregistrer")
            }
        }
    }
}
