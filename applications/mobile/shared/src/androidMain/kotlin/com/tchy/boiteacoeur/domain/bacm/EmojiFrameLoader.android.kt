package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.platform.PlatformContext
import kotlin.math.sqrt

actual object EmojiFrameLoader {
    private val frameCache = mutableMapOf<String, List<IconFrameData>>()

    actual suspend fun loadFrames(ref: String, size: Int): List<IconFrameData>? {
        val cacheKey = "$ref@$size"
        frameCache[cacheKey]?.let { return it }
        val folder = resolveEmojiFolder(ref) ?: return null
        val static = readAsset("emojis/$folder/s.rgb565")
        if (static != null) {
            val decoded = decodeFrame(static, readAsset("emojis/$folder/s.alpha"), size)
            val frames = listOf(decoded)
            frameCache[cacheKey] = frames
            return frames
        }
        val frames = mutableListOf<IconFrameData>()
        var index = 0
        while (index <= 72) {
            val path = "emojis/$folder/f${index.toString().padStart(2, '0')}.rgb565"
            val bytes = readAsset(path) ?: break
            val alpha = readAsset("emojis/$folder/f${index.toString().padStart(2, '0')}.alpha")
            frames += decodeFrame(bytes, alpha, size)
            index++
        }
        if (frames.isEmpty()) return null
        frameCache[cacheKey] = frames
        return frames
    }

    actual suspend fun loadThumbnail(ref: String, size: Int): IconFrameData? {
        val folder = resolveEmojiFolder(ref) ?: return null
        val static = readAsset("emojis/$folder/s.rgb565")
        if (static != null) {
            return decodeFrame(static, readAsset("emojis/$folder/s.alpha"), size)
        }
        val bytes = readAsset("emojis/$folder/f00.rgb565") ?: return null
        return decodeFrame(bytes, readAsset("emojis/$folder/f00.alpha"), size)
    }

    private fun resolveEmojiFolder(ref: String): String? {
        val normalized = ref.removePrefix("emoji:").lowercase().replace("-", "_")
        val preferred = BUNDLED_EMOJIS.firstOrNull { it.ref == ref }?.folder
            ?: BUNDLED_EMOJIS.firstOrNull {
                it.ref.removePrefix("emoji:").replace("-", "_") == normalized
            }?.folder
            ?: emojiRefToFolder(ref)
        val candidates = listOf(preferred) + BUNDLED_EMOJIS.map { it.folder }
        return candidates.distinct().firstOrNull { folder ->
            readAsset("emojis/$folder/f00.rgb565") != null ||
                readAsset("emojis/$folder/s.rgb565") != null
        }
    }

    private fun readAsset(path: String): ByteArray? {
        return try {
            PlatformContext.appContext.assets.open(path).use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeFrame(bytes: ByteArray, alphaBytes: ByteArray?, targetSize: Int): IconFrameData {
        val srcSide = sqrt(bytes.size / 2.0).toInt().coerceAtLeast(1)
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
        val alpha = if (alphaBytes != null && alphaBytes.size >= srcSide * srcSide) {
            alphaBytes.copyOf(srcSide * srcSide)
        } else {
            null
        }
        if (srcSide == targetSize) {
            return IconFrameData(src, srcSide, alpha)
        }
        val out = ShortArray(targetSize * targetSize)
        val outAlpha = alpha?.let { ByteArray(targetSize * targetSize) }
        for (y in 0 until targetSize) {
            for (x in 0 until targetSize) {
                val sx = x * srcSide / targetSize
                val sy = y * srcSide / targetSize
                val si = sy * srcSide + sx
                out[y * targetSize + x] = src[si]
                outAlpha?.set(y * targetSize + x, alpha[si])
            }
        }
        return IconFrameData(out, targetSize, outAlpha)
    }
}
