package com.tchy.boiteacoeur.domain.bacm

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene

actual class SceneRasterizer actual constructor() {
    actual fun rasterBackground(scene: MessageScene): ShortArray {
        val bitmap = Bitmap.createBitmap(AppConfig.MSG_WIDTH, AppConfig.MSG_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        if (scene.bgType == "image" && scene.bgImageBytes != null) {
            val src = BitmapFactory.decodeByteArray(scene.bgImageBytes, 0, scene.bgImageBytes.size)
            if (src != null) {
                val scale = maxOf(
                    AppConfig.MSG_WIDTH.toFloat() / src.width,
                    AppConfig.MSG_HEIGHT.toFloat() / src.height,
                )
                val dw = src.width * scale
                val dh = src.height * scale
                canvas.drawBitmap(src, null, android.graphics.RectF(
                    (AppConfig.MSG_WIDTH - dw) / 2f,
                    (AppConfig.MSG_HEIGHT - dh) / 2f,
                    (AppConfig.MSG_WIDTH + dw) / 2f,
                    (AppConfig.MSG_HEIGHT + dh) / 2f,
                ), null)
                src.recycle()
            } else {
                canvas.drawColor(Color.parseColor(scene.bgColor))
            }
        } else {
            canvas.drawColor(Color.parseColor(scene.bgColor))
        }
        return bitmapTo565(bitmap)
    }

    actual fun bakeText(bg: ShortArray, layer: MessageLayer) {
        val bitmap = Bitmap.createBitmap(layer.w, layer.h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor(layer.color)
            textSize = layer.fontSize.toFloat()
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = when (layer.align) {
                "left" -> Paint.Align.LEFT
                "right" -> Paint.Align.RIGHT
                else -> Paint.Align.CENTER
            }
        }
        val tx = when (layer.align) {
            "left" -> 8f
            "right" -> layer.w - 8f
            else -> layer.w / 2f
        }
        val lines = layer.text.split("\n")
        val lh = layer.fontSize.toFloat()
        var y = layer.h / 2f - ((lines.size - 1) * lh) / 2f
        for (line in lines) {
            canvas.drawText(line, tx, y, paint)
            y += lh
        }
        compositeBitmapOnto565(bg, bitmap, layer.x, layer.y)
        bitmap.recycle()
    }

    actual fun bakeImage(bg: ShortArray, layer: MessageLayer, imageBytes: ByteArray) {
        val src = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size) ?: return
        val bitmap = Bitmap.createBitmap(layer.w, layer.h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val scale = maxOf(layer.w.toFloat() / src.width, layer.h.toFloat() / src.height)
        val dw = src.width * scale
        val dh = src.height * scale
        canvas.drawBitmap(src, null, android.graphics.RectF(
            (layer.w - dw) / 2f,
            (layer.h - dh) / 2f,
            (layer.w + dw) / 2f,
            (layer.h + dh) / 2f,
        ), null)
        src.recycle()
        compositeBitmapOnto565(bg, bitmap, layer.x, layer.y)
        bitmap.recycle()
    }

    actual fun bakeIconFrame(bg: ShortArray, layer: MessageLayer, frame: ShortArray) {
        val side = layer.size
        for (y in 0 until side) {
            for (x in 0 until side) {
                val fg = frame.getOrElse(y * side + x) { 0 }.toInt() and 0xFFFF
                val bi = (layer.y + y) * AppConfig.MSG_WIDTH + (layer.x + x)
                if (bi in bg.indices) bg[bi] = fg.toShort()
            }
        }
    }

    private fun compositeBitmapOnto565(bg: ShortArray, bitmap: Bitmap, ox: Int, oy: Int) {
        val w = bitmap.width
        val h = bitmap.height
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        for (y in 0 until h) {
            for (x in 0 until w) {
                val c = pixels[y * w + x]
                val a = Color.alpha(c)
                if (a < 8) continue
                val fg = BacMessagePack.rgb888To565(Color.red(c), Color.green(c), Color.blue(c))
                val bi = (oy + y) * AppConfig.MSG_WIDTH + (ox + x)
                if (bi !in bg.indices) continue
                bg[bi] = if (a >= 250) {
                    fg.toShort()
                } else {
                    BacMessagePack.blend565(bg[bi].toInt() and 0xFFFF, fg, a).toShort()
                }
            }
        }
    }

    private fun bitmapTo565(bitmap: Bitmap): ShortArray {
        val w = bitmap.width
        val h = bitmap.height
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        val out = ShortArray(w * h)
        for (i in pixels.indices) {
            val c = pixels[i]
            out[i] = BacMessagePack.rgb888To565(Color.red(c), Color.green(c), Color.blue(c)).toShort()
        }
        bitmap.recycle()
        return out
    }
}
