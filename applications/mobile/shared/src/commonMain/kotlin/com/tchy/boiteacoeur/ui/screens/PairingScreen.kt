package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
fun PairingScreen(vm: AppViewModel, onDone: () -> Unit) {
    var inviteToken by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Liaison partenaire")
        Button(onClick = { vm.createInvite() }, modifier = Modifier.fillMaxWidth()) {
            Text("Générer un lien d'invitation")
        }
        vm.inviteUrl?.let { url ->
            Card(Modifier.fillMaxWidth()) {
                Text(url, modifier = Modifier.padding(12.dp))
            }
        }
        OutlinedTextField(
            value = inviteToken,
            onValueChange = { inviteToken = it },
            label = { Text("Token invitation reçu") },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { vm.acceptInviteToken(inviteToken.trim()) },
            enabled = inviteToken.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Accepter invitation") }

        Text("Ou demander par le nom de la boîte partenaire")
        OutlinedTextField(
            value = vm.pairDeviceName,
            onValueChange = { vm.pairDeviceName = it },
            label = { Text("Nom de la boîte partenaire") },
            placeholder = { Text("BoiteACoeur") },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { vm.requestPairing() },
            enabled = vm.pairDeviceName.isNotBlank() && !vm.loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Envoyer la demande")
        }

        vm.pendingRequests.forEach { req ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("Demande de ${req.fromEmail}")
                    Button(onClick = { vm.acceptPairing(req.pairingId) }) { Text("Accepter") }
                    Button(onClick = { vm.rejectPairing(req.pairingId) }) { Text("Refuser") }
                }
            }
        }
        Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text("Retour") }
    }
}
