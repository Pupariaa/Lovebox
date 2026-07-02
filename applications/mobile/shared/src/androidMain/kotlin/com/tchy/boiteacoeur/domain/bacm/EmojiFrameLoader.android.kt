package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.platform.PlatformContext
import java.io.InputStream

actual object EmojiFrameLoader {
    actual suspend fun loadFrames(ref: String, size: Int): List<ShortArray>? {
        val emojiId = ref.removePrefix("emoji:").ifBlank { return null }
        val folder = emojiFolderName(emojiId) ?: return null
        val frames = mutableListOf<ShortArray>()
        var index = 0
        while (true) {
            val path = "emojis/$folder/f${index.toString().padStart(2, '0')}.rgb565"
            val bytes = readAsset(path) ?: break
            frames += decodeRgb565(bytes, size)
            index++
            if (index > 72) break
        }
        return frames.ifEmpty { null }
    }

    private fun emojiFolderName(id: String): String? = when (id.lowercase()) {
        "1f48c" -> "1f48c"
        "1f389" -> "1f389_w_w_mqzx3u1111"
        "1f329", "1f329_fe0f" -> "1f329_fe0f"
        else -> id
    }

    private fun readAsset(path: String): ByteArray? {
        return try {
            PlatformContext.appContext.assets.open(path).use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeRgb565(bytes: ByteArray, targetSize: Int): ShortArray {
        val srcSide = kotlin.math.sqrt(bytes.size / 2.0).toInt()
        if (srcSide <= 0) return ShortArray(targetSize * targetSize)
        val src = ShortArray(srcSide * srcSide)
        var i = 0
        var j = 0
        while (j < src.size && i + 1 < bytes.size) {
            val lo = bytes[i].toInt() and 0xFF
            val hi = bytes[i + 1].toInt() and 0xFF
            src[j] = (lo or (hi shl 8)).toShort()
            i += 2
            j++
        }
        if (srcSide == targetSize) return src
        val out = ShortArray(targetSize * targetSize)
        for (y in 0 until targetSize) {
            for (x in 0 until targetSize) {
                val sx = x * srcSide / targetSize
                val sy = y * srcSide / targetSize
                out[y * targetSize + x] = src[sy * srcSide + sx]
            }
        }
        return out
    }
}
