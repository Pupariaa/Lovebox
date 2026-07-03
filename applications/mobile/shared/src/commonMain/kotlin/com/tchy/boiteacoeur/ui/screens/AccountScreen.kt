package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun AccountScreen(
    vm: AppViewModel,
    onBack: () -> Unit,
) {
    LaunchedEffect(Unit) { vm.loadUserProfile() }

    var firstName by remember(vm.userProfile) { mutableStateOf(vm.userProfile?.firstName.orEmpty()) }
    var lastName by remember(vm.userProfile) { mutableStateOf(vm.userProfile?.lastName.orEmpty()) }
    var locale by remember(vm.userProfile) { mutableStateOf(vm.userProfile?.locale ?: "fr") }
    var password by remember { mutableStateOf("") }

    AppScaffold(title = "Mon profil", onBack = onBack) { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = vm.userProfile?.email ?: "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = firstName,
                onValueChange = { firstName = it },
                label = { Text("Prénom") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = lastName,
                onValueChange = { lastName = it },
                label = { Text("Nom") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = locale,
                onValueChange = { locale = it },
                label = { Text("Langue (ex. fr)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Nouveau mot de passe") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            Spacer(Modifier.weight(1f))

            Button(
                onClick = {
                    vm.updateUserProfile(
                        firstName = firstName.trim().ifBlank { null },
                        lastName = lastName.trim().ifBlank { null },
                        locale = locale.trim().ifBlank { null },
                        password = password.trim().ifBlank { null },
                    )
                    password = ""
                },
                enabled = !vm.loading,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Enregistrer")
            }
        }
    }
}
