package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene

object BacMessagePack {
    const val LAYER_STATIC = 0
    const val LAYER_ANIM = 1

    fun createDefaultScene(): MessageScene = MessageScene(
        layers = listOf(
            MessageLayer(
                id = "t1",
                type = "text",
                text = "Ton message",
                y = 100,
                h = 40,
                color = "#FFF5F0",
            ),
        ),
    )

    suspend fun buildFromScene(
        scene: MessageScene,
        rasterizer: SceneRasterizer,
        animFrames: suspend (String, Int) -> List<IconFrameData>?,
    ): ByteArray {
        val bg = rasterizer.rasterBackground(scene)
        val layers = mutableListOf<AnimLayer>()
        for (layer in scene.layers) {
            if (layer.hidden) continue
            when (layer.type) {
                "text" -> rasterizer.bakeText(bg, layer)
                "photo" -> layer.imageBytes?.let { rasterizer.bakeImage(bg, layer, it) }
                "icon" -> {
                    if (layer.anim) {
                        val frames = animFrames(layer.ref, layer.size)
                        if (!frames.isNullOrEmpty()) {
                            layers += buildAnimLayer(bg, layer, frames, layer.fps)
                        }
                    } else {
                        animFrames(layer.ref, layer.size)?.firstOrNull()?.let {
                            rasterizer.bakeIconFrame(bg, layer, it)
                        }
                    }
                }
            }
        }
        return packMessage(bg, layers)
    }

    private data class AnimLayer(
        val type: Int,
        val x: Int,
        val y: Int,
        val w: Int,
        val h: Int,
        val fps: Int,
        val frameCount: Int,
        val data: ShortArray,
    )

    private fun buildAnimLayer(
        bg: ShortArray,
        layer: MessageLayer,
        frames: List<IconFrameData>,
        fps: Int,
    ): AnimLayer {
        val side = layer.size
        val framePixels = ShortArray(side * side * frames.size)
        frames.forEachIndexed { index, frame ->
            val composed = compositeIconOnBgCopy(
                bg = bg,
                layerX = layer.x,
                layerY = layer.y,
                side = side,
                frame = frame.pixels,
                frameSide = frame.side,
                alpha = frame.alpha,
            )
            val crop = cropRect(composed, AppConfig.MSG_WIDTH, layer.x, layer.y, side, side)
            crop.copyInto(framePixels, index * side * side)
        }
        return AnimLayer(LAYER_ANIM, layer.x, layer.y, side, side, fps, frames.size, framePixels)
    }

    fun blend565(bg: Int, fg: Int, alpha: Int): Int {
        val a = alpha.coerceIn(0, 255)
        val inv = 255 - a
        val br = (bg shr 11) and 0x1F
        val bgG = (bg shr 5) and 0x3F
        val bb = bg and 0x1F
        val fr = (fg shr 11) and 0x1F
        val fgG = (fg shr 5) and 0x3F
        val fb = fg and 0x1F
        val r = (br * inv + fr * a) / 255
        val g = (bgG * inv + fgG * a) / 255
        val b = (bb * inv + fb * a) / 255
        return (r shl 11) or (g shl 5) or b
    }

    fun rgb888To565(r: Int, g: Int, b: Int): Int =
        (((r and 0xF8) shl 8) or ((g and 0xFC) shl 3) or (b shr 3)) and 0xFFFF

    fun hexTo565(hex: String): Int {
        val h = hex.removePrefix("#")
        val r = h.substring(0, 2).toInt(16)
        val g = h.substring(2, 4).toInt(16)
        val b = h.substring(4, 6).toInt(16)
        return rgb888To565(r, g, b)
    }

    private fun packMessage(bg: ShortArray, layers: List<AnimLayer>): ByteArray {
        var total = 12 + bg.size * 2
        layers.forEach { total += 16 + it.data.size * 2 }
        val buf = ByteArray(total)
        buf[0] = 0x42
        buf[1] = 0x41
        buf[2] = 0x43
        buf[3] = 0x4D
        writeU16(buf, 4, 1)
        writeU16(buf, 6, AppConfig.MSG_WIDTH)
        writeU16(buf, 8, AppConfig.MSG_HEIGHT)
        buf[10] = layers.size.toByte()
        buf[11] = 0
        var off = 12
        for (px in bg) {
            writeU16(buf, off, px.toInt() and 0xFFFF)
            off += 2
        }
        for (layer in layers) {
            buf[off] = layer.type.toByte()
            buf[off + 1] = layer.fps.toByte()
            writeU16(buf, off + 2, layer.x)
            writeU16(buf, off + 4, layer.y)
            writeU16(buf, off + 6, layer.w)
            writeU16(buf, off + 8, layer.h)
            writeU16(buf, off + 10, layer.frameCount)
            writeU32(buf, off + 12, layer.data.size * 2)
            off += 16
            for (px in layer.data) {
                writeU16(buf, off, px.toInt() and 0xFFFF)
                off += 2
            }
        }
        return buf
    }

    private fun writeU16(buf: ByteArray, off: Int, v: Int) {
        buf[off] = (v and 0xFF).toByte()
        buf[off + 1] = ((v shr 8) and 0xFF).toByte()
    }

    private fun writeU32(buf: ByteArray, off: Int, v: Int) {
        buf[off] = (v and 0xFF).toByte()
        buf[off + 1] = ((v shr 8) and 0xFF).toByte()
        buf[off + 2] = ((v shr 16) and 0xFF).toByte()
        buf[off + 3] = ((v shr 24) and 0xFF).toByte()
    }
}
