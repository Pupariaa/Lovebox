package com.tchy.boiteacoeur.domain.bacm

import android.graphics.Bitmap
import android.graphics.Color

object Rgb565Bitmap {
    fun fromPixels(
        pixels: ShortArray,
        width: Int,
        height: Int,
        alpha: ByteArray? = null,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val argb = IntArray(width * height)
        for (i in pixels.indices) {
            val px = pixels[i].toInt() and 0xFFFF
            val r = ((px shr 11) and 0x1F) shl 3
            val g = ((px shr 5) and 0x3F) shl 2
            val b = (px and 0x1F) shl 3
            val a = when {
                alpha != null && i < alpha.size -> alpha[i].toInt() and 0xFF
                px == 0 -> 0
                else -> 255
            }
            argb[i] = Color.argb(a, r, g, b)
        }
        bitmap.setPixels(argb, 0, width, 0, 0, width, height)
        return bitmap
    }
}
