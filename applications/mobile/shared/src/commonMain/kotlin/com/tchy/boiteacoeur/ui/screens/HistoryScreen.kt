package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun HistoryScreen(vm: AppViewModel, onBack: () -> Unit) {
    LaunchedEffect(Unit) { vm.loadHistory() }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Messages envoyés")
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(vm.history) { item ->
                Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Vers ${item.targetDeviceName}")
                        Text(item.createdAt)
                    }
                }
            }
        }
        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Retour") }
    }
}
