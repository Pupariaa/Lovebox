package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer

data class LayerRect(val x: Int, val y: Int, val w: Int, val h: Int)

fun layerBounds(layer: MessageLayer): LayerRect = when (layer.type) {
    "text" -> LayerRect(layer.x, layer.y, layer.w, layer.h)
    "photo" -> LayerRect(layer.x, layer.y, layer.w, layer.h)
    "icon" -> LayerRect(layer.x, layer.y, layer.size, layer.size)
    else -> LayerRect(0, 0, 0, 0)
}

fun hitTestLayer(layers: List<MessageLayer>, px: Int, py: Int): MessageLayer? {
    for (i in layers.indices.reversed()) {
        val layer = layers[i]
        if (layer.hidden) continue
        val b = layerBounds(layer)
        if (px in b.x until b.x + b.w && py in b.y until b.y + b.h) return layer
    }
    return null
}

fun clampLayerPosition(x: Int, y: Int, layer: MessageLayer): Pair<Int, Int> {
    val b = layerBounds(layer)
    val maxX = (AppConfig.MSG_WIDTH - b.w).coerceAtLeast(0)
    val maxY = (AppConfig.MSG_HEIGHT - b.h).coerceAtLeast(0)
    return x.coerceIn(0, maxX) to y.coerceIn(0, maxY)
}

fun nextLayerId(layers: List<MessageLayer>, prefix: String): String {
    val nums = layers.filter { it.id.startsWith(prefix) }.mapNotNull { layer ->
        layer.id.removePrefix(prefix).toIntOrNull()
    }
    return "$prefix${(nums.maxOrNull() ?: 0) + 1}"
}

fun emojiRefToFolder(ref: String): String {
    val raw = ref.removePrefix("emoji:").trim()
    return raw
        .replace(":", "_")
        .replace(Regex("[^a-zA-Z0-9_]"), "_")
        .removePrefix("emoji_")
}

fun sceneVisualKey(scene: com.tchy.boiteacoeur.data.model.MessageScene): String = buildString {
    append(scene.bgColor)
    append('|')
    append(scene.bgType)
    append('|')
    scene.layers.forEach { layer ->
        append(layer.id)
        append(':')
        append(layer.type)
        append(':')
        append(layer.hidden)
        append(':')
        append(layer.text)
        append(':')
        append(layer.ref)
        append(':')
        append(layer.w)
        append(':')
        append(layer.h)
        append(':')
        append(layer.size)
        append(':')
        append(layer.color)
        append(':')
        append(layer.fontSize)
        append(':')
        append(layer.align)
        append(':')
        append(layer.anim)
        append(';')
    }
}

fun scenePositionKey(scene: com.tchy.boiteacoeur.data.model.MessageScene): String =
    scene.layers.joinToString(";") { "${it.id}:${it.x},${it.y}" }
