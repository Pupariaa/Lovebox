package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun ComposerScreen(vm: AppViewModel, onSent: () -> Unit) {
    val scene = vm.composerScene
    var messageText by remember(scene) {
        mutableStateOf(scene.layers.firstOrNull { it.type == "text" }?.text ?: "")
    }
    var bgColor by remember(scene) { mutableStateOf(scene.bgColor) }

    Column(
        Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
    ) {
        Text("Éditeur ${AppConfig.MSG_WIDTH}x${AppConfig.MSG_HEIGHT}")
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(AppConfig.MSG_WIDTH.toFloat() / AppConfig.MSG_HEIGHT)
                .background(hexToComposeColor(bgColor))
                .border(1.dp, Color.White.copy(alpha = 0.3f))
                .padding(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(messageText, color = Color(0xFFE09090))
        }
        OutlinedTextField(
            value = messageText,
            onValueChange = { messageText = it },
            label = { Text("Message") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        )
        OutlinedTextField(
            value = bgColor,
            onValueChange = { bgColor = it },
            label = { Text("Couleur fond (#RRGGBB)") },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                val layers = scene.layers.map { layer ->
                    if (layer.type == "text") layer.copy(text = messageText) else layer
                }
                vm.composerScene = scene.copy(bgColor = bgColor, layers = layers)
                vm.sendMessage(onSent)
            },
            enabled = !vm.loading,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) { Text("Envoyer") }
    }
}

private fun hexToComposeColor(hex: String): Color {
    val h = hex.removePrefix("#")
    if (h.length != 6) return Color(0xFF120310)
    val r = h.substring(0, 2).toIntOrNull(16) ?: 0
    val g = h.substring(2, 4).toIntOrNull(16) ?: 0
    val b = h.substring(4, 6).toIntOrNull(16) ?: 0
    return Color(r, g, b)
}
