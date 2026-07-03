package com.tchy.boiteacoeur.domain.bacm

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color

@Composable
actual fun Rgb565Image(
    pixels: ShortArray,
    modifier: Modifier,
    width: Int,
    height: Int,
    alpha: ByteArray?,
) {
    Canvas(modifier) {
        val scaleX = size.width / width
        val scaleY = size.height / height
        for (y in 0 until height) {
            for (x in 0 until width) {
                val i = y * width + x
                val px = pixels[i].toInt() and 0xFFFF
                val a = when {
                    alpha != null && i < alpha.size -> alpha[i].toInt() and 0xFF
                    px == 0 -> 0
                    else -> 255
                }
                if (a < 8) continue
                val r = ((px shr 11) and 0x1F) shl 3
                val g = ((px shr 5) and 0x3F) shl 2
                val b = (px and 0x1F) shl 3
                drawRect(
                    color = Color(r, g, b, a / 255f),
                    topLeft = Offset(x * scaleX, y * scaleY),
                    size = Size(scaleX + 0.5f, scaleY + 0.5f),
                )
            }
        }
    }
}
