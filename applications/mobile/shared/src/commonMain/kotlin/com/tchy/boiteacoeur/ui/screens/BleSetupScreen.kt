package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothSearching
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.ble.BleDeviceItem
import com.tchy.boiteacoeur.platform.rememberBluetoothPermissionRequester
import com.tchy.boiteacoeur.ui.components.AppBackground
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel
import com.tchy.boiteacoeur.ui.viewmodel.BleProvisionPhase

private enum class BleSetupStep {
    Scan,
    Credentials,
    Provisioning,
    Result,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BleSetupScreen(vm: AppViewModel, onDone: () -> Unit) {
    var step by remember { mutableStateOf(BleSetupStep.Scan) }
    var ssid by remember { mutableStateOf(AppConfig.DEV_WIFI_SSID) }
    var password by remember { mutableStateOf(AppConfig.DEV_WIFI_PASSWORD) }
    var selectedDevice by remember { mutableStateOf<BleDeviceItem?>(null) }
    var permissionsGranted by remember { mutableStateOf(false) }

    val requestPermissions = rememberBluetoothPermissionRequester { granted ->
        permissionsGranted = granted
        if (!granted) {
            vm.showSnackbar("Autorise le Bluetooth pour scanner")
        }
    }

    LaunchedEffect(Unit) {
        requestPermissions()
        vm.resetBleProvision()
    }

    fun goBack() {
        when (step) {
            BleSetupStep.Scan -> onDone()
            BleSetupStep.Credentials -> step = BleSetupStep.Scan
            BleSetupStep.Result -> {
                vm.resetBleProvision()
                onDone()
            }
            BleSetupStep.Provisioning -> Unit
        }
    }

    Box(Modifier.fillMaxSize()) {
        AppBackground()

        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            TopAppBar(
                title = {
                    Text(
                        when (step) {
                            BleSetupStep.Scan -> "Configuration WiFi"
                            BleSetupStep.Credentials -> "Réseau WiFi"
                            BleSetupStep.Provisioning -> "Connexion en cours"
                            BleSetupStep.Result -> "Résultat"
                        },
                    )
                },
                navigationIcon = {
                    if (step != BleSetupStep.Provisioning) {
                        IconButton(onClick = { goBack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0f),
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )

            when (step) {
                BleSetupStep.Scan -> {
                    if (!permissionsGranted) {
                        PermissionCard(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            onRequest = requestPermissions,
                        )
                    } else {
                        ScanStep(
                            vm = vm,
                            selectedDevice = selectedDevice,
                            onSelect = { selectedDevice = it },
                            onContinue = {
                                if (selectedDevice != null) step = BleSetupStep.Credentials
                            },
                        )
                    }
                }
                BleSetupStep.Credentials -> {
                    CredentialsStep(
                        device = selectedDevice ?: return@Column,
                        ssid = ssid,
                        password = password,
                        onSsidChange = { ssid = it },
                        onPasswordChange = { password = it },
                        loading = vm.loading,
                        onSubmit = {
                            val device = selectedDevice ?: return@CredentialsStep
                            step = BleSetupStep.Provisioning
                            vm.provisionBle(
                                address = device.address,
                                deviceName = device.name,
                                ssid = ssid,
                                password = password,
                            ) { step = BleSetupStep.Result }
                        },
                    )
                }
                BleSetupStep.Provisioning -> {
                    ProvisioningStep(
                        phase = vm.bleProvisionPhase,
                        wifiProvisioned = vm.bleWifiProvisioned,
                        deviceName = vm.bleProvisionDeviceName,
                    )
                }
                BleSetupStep.Result -> {
                    ResultStep(
                        success = vm.bleProvisionPhase == BleProvisionPhase.Success,
                        deviceName = vm.bleProvisionDeviceName,
                        error = vm.bleProvisionError,
                        wifiProvisioned = vm.bleWifiProvisioned,
                        loading = vm.loading,
                        onContinue = {
                            vm.resetBleProvision()
                            onDone()
                        },
                        onRetryLink = {
                            step = BleSetupStep.Provisioning
                            vm.retryClaimAfterProvision { step = BleSetupStep.Result }
                        },
                        onRetryWifi = {
                            vm.resetBleProvision()
                            step = BleSetupStep.Credentials
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ScanStep(
    vm: AppViewModel,
    selectedDevice: BleDeviceItem?,
    onSelect: (BleDeviceItem) -> Unit,
    onContinue: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            text = "Allume ta boîte et ouvre la configuration WiFi sur son écran (mode Bluetooth actif).",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Button(
            onClick = { vm.scanBle() },
            enabled = !vm.loading,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
        ) {
            Icon(Icons.Default.BluetoothSearching, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text(if (vm.loading) "Recherche..." else "Rechercher ma boîte")
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (vm.bleDevices.isEmpty() && !vm.loading) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                ) {
                    Text(
                        text = "Aucune boîte trouvée. Vérifie le mode configuration et la proximité.",
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            vm.bleDevices.take(4).forEach { device ->
                val selected = selectedDevice?.address == device.address
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(device) },
                    shape = MaterialTheme.shapes.medium,
                    colors = CardDefaults.cardColors(
                        containerColor = if (selected) {
                            RosePrimary.copy(alpha = 0.15f)
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f)
                        },
                    ),
                    border = if (selected) BorderStroke(1.5.dp, RosePrimary) else null,
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(
                            device.name,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Medium,
                        )
                        Text(
                            device.address,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            if (vm.bleDevices.size > 4) {
                Text(
                    text = "${vm.bleDevices.size - 4} autre(s) boîte(s) détectée(s)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Button(
            onClick = onContinue,
            enabled = selectedDevice != null,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
        ) {
            Text("Continuer")
        }
    }
}

@Composable
private fun CredentialsStep(
    device: BleDeviceItem,
    ssid: String,
    password: String,
    onSsidChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    loading: Boolean,
    onSubmit: () -> Unit,
) {
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = RosePrimary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = RosePrimary,
        cursorColor = RosePrimary,
    )
    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Default.Bluetooth, contentDescription = null, tint = RosePrimary)
                Column {
                    Text(device.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
                    Text(
                        "Sera associée à ton compte après la configuration.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Text(
            text = "Entre les identifiants du réseau WiFi auquel la boîte doit se connecter.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedTextField(
            value = ssid,
            onValueChange = onSsidChange,
            label = { Text("Nom du réseau WiFi") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            colors = fieldColors,
        )
        OutlinedTextField(
            value = password,
            onValueChange = onPasswordChange,
            label = { Text("Mot de passe WiFi") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            colors = fieldColors,
        )
        }

        Button(
            onClick = onSubmit,
            enabled = ssid.isNotBlank() && !loading,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
        ) {
            Icon(Icons.Default.Wifi, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Configurer et associer")
        }
    }
}

@Composable
private fun ProvisioningStep(
    phase: BleProvisionPhase,
    wifiProvisioned: Boolean,
    deviceName: String?,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = RosePrimary, modifier = Modifier.size(56.dp), strokeWidth = 3.dp)
        Spacer(Modifier.height(28.dp))
        Text(
            text = "Configuration en cours",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = when (phase) {
                BleProvisionPhase.WaitingForBox ->
                    "La boîte se connecte au WiFi. Cela peut prendre une minute."
                BleProvisionPhase.LinkingAccount ->
                    "Association de ${deviceName ?: "la boîte"} à ton compte. Cela peut prendre une minute."
                else ->
                    "Ne t'éloigne pas de la boîte pendant l'opération."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        ProvisionProgressRow(
            label = "Connexion Bluetooth",
            done = phase != BleProvisionPhase.Connecting && phase != BleProvisionPhase.Failed,
            active = phase == BleProvisionPhase.Connecting,
        )
        ProvisionProgressRow(
            label = "Envoi des identifiants WiFi",
            done = phase == BleProvisionPhase.WaitingForBox ||
                phase == BleProvisionPhase.LinkingAccount ||
                phase == BleProvisionPhase.Success,
            active = phase == BleProvisionPhase.SendingWifi,
        )
        ProvisionProgressRow(
            label = "Connexion WiFi de la boîte",
            done = wifiProvisioned || phase == BleProvisionPhase.Success,
            active = phase == BleProvisionPhase.WaitingForBox,
        )
        ProvisionProgressRow(
            label = "Association à ton compte",
            done = phase == BleProvisionPhase.Success,
            active = phase == BleProvisionPhase.LinkingAccount,
        )
    }
}

@Composable
private fun ProvisionProgressRow(label: String, done: Boolean, active: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (done) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RosePrimary)
        } else if (active) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = RosePrimary)
        } else {
            Box(Modifier.size(24.dp))
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = when {
                done -> MaterialTheme.colorScheme.onSurface
                active -> RosePrimary
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            },
            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
        )
    }
}

@Composable
private fun ResultStep(
    success: Boolean,
    deviceName: String?,
    error: String?,
    wifiProvisioned: Boolean,
    loading: Boolean,
    onContinue: () -> Unit,
    onRetryLink: () -> Unit,
    onRetryWifi: () -> Unit,
) {
    val partialClaimFailure = !success && wifiProvisioned

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = if (success) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
            contentDescription = null,
            tint = if (success) RosePrimary else MaterialTheme.colorScheme.error,
            modifier = Modifier.size(72.dp),
        )
        Spacer(Modifier.height(24.dp))
        Text(
            text = when {
                success -> "Boîte configurée"
                partialClaimFailure -> "WiFi OK, association en attente"
                else -> "Échec de la configuration"
            },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            text = when {
                success -> "${deviceName ?: "Ta boîte"} est connectée au WiFi et associée à ton compte. Tu peux inviter ton partenaire quand tu veux."
                partialClaimFailure -> error ?: "Le WiFi est configuré sur la boîte. L'enregistrement au compte peut prendre une minute."
                else -> error ?: "La boîte n'a pas pu se connecter au WiFi. Vérifie le réseau (2,4 GHz), le mot de passe, puis réessaie."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        if (success) {
            Button(
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Continuer")
            }
        } else {
            if (partialClaimFailure) {
                Button(
                    onClick = onRetryLink,
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
                ) {
                    Text(if (loading) "Association..." else "Réessayer l'association")
                }
                Spacer(Modifier.height(12.dp))
            }
            OutlinedButton(
                onClick = onRetryWifi,
                enabled = !loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text("Recommencer")
            }
        }
    }
}

@Composable
private fun PermissionCard(modifier: Modifier = Modifier, onRequest: () -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        border = BorderStroke(1.dp, RosePrimary.copy(alpha = 0.4f)),
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(
                Icons.Default.Bluetooth,
                contentDescription = null,
                tint = RosePrimary,
                modifier = Modifier.size(48.dp),
            )
            Text(
                text = "Autorisation Bluetooth",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Text(
                text = "Pour trouver et configurer ta boîte, l'app a besoin d'accéder au Bluetooth.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Button(
                onClick = onRequest,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Autoriser")
            }
        }
    }
}
