package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppBackground
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClaimScreen(vm: AppViewModel, onDone: () -> Unit) {
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = RosePrimary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = RosePrimary,
        cursorColor = RosePrimary,
    )

    Box(Modifier.fillMaxSize()) {
        AppBackground()

        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            TopAppBar(
                title = { Text("Lier ma boîte") },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0f),
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    text = "Entre le nom affiché sur l'écran de ta boîte pendant la configuration.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "C'est le nom que tu as choisi lors du premier démarrage (par défaut BoiteACoeur).",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                OutlinedTextField(
                    value = vm.claimDeviceName,
                    onValueChange = { vm.claimDeviceName = it },
                    label = { Text("Nom de la boîte") },
                    placeholder = { Text("BoiteACoeur") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    colors = fieldColors,
                )

                Spacer(Modifier.height(8.dp))

                Button(
                    onClick = { vm.claimDevice(onDone) },
                    enabled = vm.claimDeviceName.isNotBlank() && !vm.loading,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = MaterialTheme.shapes.medium,
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
}
