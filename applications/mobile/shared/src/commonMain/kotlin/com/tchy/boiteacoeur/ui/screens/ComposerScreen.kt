package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.domain.bacm.BUNDLED_EMOJIS
import com.tchy.boiteacoeur.domain.bacm.COMPOSER_COLOR_PALETTE
import com.tchy.boiteacoeur.domain.bacm.IconThumbnail
import com.tchy.boiteacoeur.domain.bacm.SceneEditorCanvas
import com.tchy.boiteacoeur.domain.bacm.SceneRasterizer
import com.tchy.boiteacoeur.domain.bacm.nextLayerId
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.components.TabScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.util.targetLabel
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

private enum class ComposerTool {
    None,
    Text,
    Icon,
    Background,
}

@Composable
fun ComposerScreen(
    vm: AppViewModel,
    embedded: Boolean = false,
    onBack: () -> Unit = {},
    onSent: () -> Unit,
) {
    if (embedded) {
        TabScaffold(title = "Ecrire") { modifier ->
            ComposerContent(vm = vm, modifier = modifier, onSent = onSent)
        }
    } else {
        AppScaffold(title = "Ecrire", onBack = onBack) { modifier ->
            ComposerContent(vm = vm, modifier = modifier, onSent = onSent)
        }
    }
}

@Composable
private fun ComposerContent(
    vm: AppViewModel,
    modifier: Modifier,
    onSent: () -> Unit,
) {
    var scene by remember { mutableStateOf(vm.composerScene) }
    var selectedLayerId by remember { mutableStateOf(scene.layers.firstOrNull()?.id) }
    var activeTool by remember { mutableStateOf(ComposerTool.None) }
    val rasterizer = remember { SceneRasterizer() }
    val selectedLayer = scene.layers.find { it.id == selectedLayerId }

    Column(
        modifier
            .fillMaxSize()
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Message", style = MaterialTheme.typography.titleSmall)
                Text(
                    text = "${AppConfig.MSG_WIDTH}x${AppConfig.MSG_HEIGHT}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = when {
                    vm.selectedTarget == null -> "Aucun destinataire"
                    else -> targetLabel(vm.selectedTarget!!)
                },
                style = MaterialTheme.typography.labelSmall,
                color = if (vm.selectedTarget == null) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Surface(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = hexToComposeColor(scene.bgColor),
        ) {
            SceneEditorCanvas(
                scene = scene,
                rasterizer = rasterizer,
                selectedLayerId = selectedLayerId,
                onSelectLayer = {
                    selectedLayerId = it
                    if (it != null) activeTool = ComposerTool.None
                },
                onMoveLayer = { id, x, y ->
                    scene = scene.copy(
                        layers = scene.layers.map { layer ->
                            if (layer.id == id) layer.copy(x = x, y = y) else layer
                        },
                    )
                },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ComposerToolButton(
                label = "Texte",
                icon = { Icon(Icons.Default.TextFields, contentDescription = null, modifier = Modifier.size(20.dp)) },
                selected = activeTool == ComposerTool.Text,
                onClick = {
                    activeTool = if (activeTool == ComposerTool.Text) ComposerTool.None else ComposerTool.Text
                },
                modifier = Modifier.weight(1f),
            )
            ComposerToolButton(
                label = "Icone",
                icon = { Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(20.dp)) },
                selected = activeTool == ComposerTool.Icon,
                onClick = {
                    activeTool = if (activeTool == ComposerTool.Icon) ComposerTool.None else ComposerTool.Icon
                },
                modifier = Modifier.weight(1f),
            )
            ComposerToolButton(
                label = "Fond",
                icon = {
                    Box(
                        Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .background(hexToComposeColor(scene.bgColor))
                            .border(1.dp, Color.White.copy(alpha = 0.4f), CircleShape),
                    )
                },
                selected = activeTool == ComposerTool.Background,
                onClick = {
                    activeTool = if (activeTool == ComposerTool.Background) ComposerTool.None else ComposerTool.Background
                },
                modifier = Modifier.weight(1f),
            )
            if (selectedLayer != null) {
                IconButton(
                    onClick = {
                        val id = selectedLayer.id
                        scene = scene.copy(layers = scene.layers.filter { it.id != id })
                        selectedLayerId = scene.layers.lastOrNull()?.id
                        activeTool = ComposerTool.None
                    },
                ) {
                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = RosePrimary)
                }
            }
        }

        when (activeTool) {
            ComposerTool.Text -> {
                val layer = selectedLayer?.takeIf { it.type == "text" } ?: run {
                    val id = nextLayerId(scene.layers, "t")
                    val created = MessageLayer(
                        id = id,
                        type = "text",
                        text = "Ton message",
                        x = 0,
                        y = 48,
                        w = 280,
                        h = 40,
                        color = "#FFF5F0",
                    )
                    scene = scene.copy(layers = scene.layers + created)
                    selectedLayerId = id
                    created
                }
                OutlinedTextField(
                    value = layer.text,
                    onValueChange = { text ->
                        scene = scene.copy(
                            layers = scene.layers.map { if (it.id == layer.id) it.copy(text = text) else it },
                        )
                    },
                    label = { Text("Texte") },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    singleLine = true,
                )
            }
            ComposerTool.Icon -> {
                val rows = BUNDLED_EMOJIS.chunked(4)
                Column(
                    modifier = Modifier.fillMaxWidth().height(128.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    rows.forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            row.forEach { emoji ->
                                Surface(
                                    onClick = {
                                        val id = nextLayerId(scene.layers, "i")
                                        val n = scene.layers.count { it.type == "icon" }
                                        val created = MessageLayer(
                                            id = id,
                                            type = "icon",
                                            ref = emoji.ref,
                                            x = 20 + (n % 5) * 44,
                                            y = 20 + (n / 5) * 44,
                                            size = 64,
                                            anim = emoji.animated,
                                            fps = 12,
                                        )
                                        scene = scene.copy(layers = scene.layers + created)
                                        selectedLayerId = id
                                        activeTool = ComposerTool.None
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(58.dp),
                                ) {
                                    Column(
                                        modifier = Modifier.fillMaxSize().padding(4.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center,
                                    ) {
                                        IconThumbnail(ref = emoji.ref, size = 26.dp, pixelSize = 32)
                                        Text(
                                            text = emoji.label,
                                            style = MaterialTheme.typography.labelSmall,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                }
                            }
                            repeat(4 - row.size) {
                                Box(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            ComposerTool.Background -> {
                val rows = COMPOSER_COLOR_PALETTE.chunked(5)
                Column(
                    modifier = Modifier.fillMaxWidth().height(68.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    rows.forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                        ) {
                            row.forEach { hex ->
                                val color = hexToComposeColor(hex)
                                val selected = hex.equals(scene.bgColor, ignoreCase = true)
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(CircleShape)
                                        .background(color)
                                        .border(
                                            width = if (selected) 2.dp else 1.dp,
                                            color = if (selected) RosePrimary
                                            else Color.White.copy(alpha = 0.35f),
                                            shape = CircleShape,
                                        )
                                        .clickable {
                                            scene = scene.copy(bgColor = hex)
                                            activeTool = ComposerTool.None
                                        },
                                )
                            }
                        }
                    }
                }
            }
            ComposerTool.None -> {
                selectedLayer?.let { layer ->
                    if (layer.type == "icon") {
                        var size by remember(layer.id) { mutableIntStateOf(layer.size) }
                        Row(
                            modifier = Modifier.fillMaxWidth().height(36.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Taille $size", style = MaterialTheme.typography.labelMedium)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                OutlinedButton(onClick = {
                                    size = (size - 8).coerceAtLeast(24)
                                    scene = scene.copy(
                                        layers = scene.layers.map {
                                            if (it.id == layer.id) it.copy(size = size) else it
                                        },
                                    )
                                }) { Text("-") }
                                OutlinedButton(onClick = {
                                    size = (size + 8).coerceAtMost(128)
                                    scene = scene.copy(
                                        layers = scene.layers.map {
                                            if (it.id == layer.id) it.copy(size = size) else it
                                        },
                                    )
                                }) { Text("+") }
                            }
                        }
                    }
                }
            }
        }

        Button(
            onClick = {
                vm.composerScene = scene
                vm.sendMessage(onSent)
            },
            enabled = !vm.loading && vm.selectedTarget != null,
            modifier = Modifier.fillMaxWidth().height(44.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
        ) {
            Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(18.dp))
            Text("Envoyer", modifier = Modifier.padding(start = 8.dp))
        }
    }
}

@Composable
private fun ComposerToolButton(
    label: String,
    icon: @Composable () -> Unit,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) RosePrimary.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
        border = if (selected) androidx.compose.foundation.BorderStroke(1.dp, RosePrimary) else null,
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            icon()
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
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
