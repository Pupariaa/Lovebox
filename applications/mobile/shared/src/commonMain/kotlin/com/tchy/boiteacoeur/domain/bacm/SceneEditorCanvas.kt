package com.tchy.boiteacoeur.domain.bacm

import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun SceneEditorCanvas(
    scene: MessageScene,
    rasterizer: SceneRasterizer,
    selectedLayerId: String?,
    onSelectLayer: (String?) -> Unit,
    onMoveLayer: (String, Int, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var previewPixels by remember { mutableStateOf<ShortArray?>(null) }
    var iconSequences by remember { mutableStateOf<Map<String, List<IconFrameData>>>(emptyMap()) }
    var dragOffset by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var draggingLayerId by remember { mutableStateOf<String?>(null) }
    var animTick by remember { mutableIntStateOf(0) }
    val visualKey = remember(scene) { sceneVisualKey(scene) }
    val positionKey = remember(scene) { scenePositionKey(scene) }
    val hasAnimatedIcons = scene.layers.any { it.type == "icon" && it.anim && !it.hidden }

    LaunchedEffect(scene.layers.map { "${it.id}:${it.ref}:${it.size}" }) {
        scene.layers.filter { it.type == "icon" && !it.hidden }.forEach { layer ->
            val key = "${layer.ref}:${layer.size}"
            if (!iconSequences.containsKey(key)) {
                val frames = EmojiFrameLoader.loadFrames(layer.ref, layer.size)
                if (!frames.isNullOrEmpty()) {
                    iconSequences = iconSequences + (key to frames)
                }
            }
        }
    }

    LaunchedEffect(hasAnimatedIcons) {
        if (!hasAnimatedIcons) return@LaunchedEffect
        while (isActive) {
            delay(83)
            animTick++
        }
    }

    LaunchedEffect(visualKey, positionKey, iconSequences, animTick) {
        delay(16)
        previewPixels = rasterizeScenePreview(scene, rasterizer, iconSequences, animTick)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(AppConfig.MSG_WIDTH.toFloat() / AppConfig.MSG_HEIGHT)
            .onSizeChanged { canvasSize = it },
    ) {
        previewPixels?.let { pixels ->
            Rgb565Image(pixels, Modifier.fillMaxSize())
        }

        val highlightId = draggingLayerId ?: selectedLayerId
        highlightId?.let { id ->
            val layer = scene.layers.find { it.id == id } ?: return@let
            if (layer.hidden || canvasSize == IntSize.Zero) return@let
            val bounds = layerBounds(layer)
            val scaleX = canvasSize.width.toFloat() / AppConfig.MSG_WIDTH
            val scaleY = canvasSize.height.toFloat() / AppConfig.MSG_HEIGHT
            androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
                drawRect(
                    color = Color(0xFFFF6B8A),
                    topLeft = Offset(bounds.x * scaleX, bounds.y * scaleY),
                    size = androidx.compose.ui.geometry.Size(bounds.w * scaleX, bounds.h * scaleY),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.5f),
                )
            }
        }

        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(scene.layers, canvasSize) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            val (px, py) = toSceneCoords(offset, canvasSize)
                            val hit = hitTestLayer(scene.layers, px, py)
                            if (hit != null) {
                                draggingLayerId = hit.id
                                onSelectLayer(hit.id)
                                dragOffset = px - hit.x to py - hit.y
                            } else {
                                draggingLayerId = null
                                onSelectLayer(null)
                                dragOffset = null
                            }
                        },
                        onDrag = { change, _ ->
                            val drag = dragOffset ?: return@detectDragGestures
                            val layerId = draggingLayerId ?: return@detectDragGestures
                            val layer = scene.layers.find { it.id == layerId } ?: return@detectDragGestures
                            change.consume()
                            val (px, py) = toSceneCoords(change.position, canvasSize)
                            val (cx, cy) = clampLayerPosition(px - drag.first, py - drag.second, layer)
                            onMoveLayer(layerId, cx, cy)
                        },
                        onDragEnd = {
                            dragOffset = null
                            draggingLayerId = null
                        },
                        onDragCancel = {
                            dragOffset = null
                            draggingLayerId = null
                        },
                    )
                },
        )
    }
}

private fun toSceneCoords(offset: Offset, size: IntSize): Pair<Int, Int> {
    if (size.width == 0 || size.height == 0) return 0 to 0
    val px = ((offset.x / size.width) * AppConfig.MSG_WIDTH).toInt()
    val py = ((offset.y / size.height) * AppConfig.MSG_HEIGHT).toInt()
    return px to py
}

fun rasterizeScenePreview(
    scene: MessageScene,
    rasterizer: SceneRasterizer,
    iconSequences: Map<String, List<IconFrameData>> = emptyMap(),
    animTick: Int = 0,
): ShortArray {
    val bg = rasterizer.rasterBackground(scene)
    scene.layers.filter { !it.hidden }.forEach { layer ->
        when (layer.type) {
            "text" -> rasterizer.bakeText(bg, layer)
            "photo" -> layer.imageBytes?.let { rasterizer.bakeImage(bg, layer, it) }
            "icon" -> {
                val key = "${layer.ref}:${layer.size}"
                val frames = iconSequences[key] ?: return@forEach
                val frameIdx = when {
                    layer.anim && frames.size > 1 -> animTick % frames.size
                    else -> 0
                }
                rasterizer.bakeIconFrame(bg, layer, frames[frameIdx])
            }
        }
    }
    return bg
}
