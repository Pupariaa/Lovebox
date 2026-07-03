package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig

fun compositeFrameOnBg(
    bg: ShortArray,
    bgW: Int,
    bgH: Int,
    frame: ShortArray,
    frameW: Int,
    frameH: Int,
    alpha: ByteArray?,
    dx: Int,
    dy: Int,
    dw: Int,
    dh: Int,
) {
    for (py in 0 until dh) {
        for (px in 0 until dw) {
            val sx = (px * frameW) / dw
            val sy = (py * frameH) / dh
            val fi = sy * frameW + sx
            if (fi !in frame.indices) continue
            val a = alpha?.getOrNull(fi)?.toInt()?.and(0xFF) ?: 255
            if (a < 8) continue
            val fg = frame[fi].toInt() and 0xFFFF
            if (alpha == null && fg == 0) continue
            val tx = dx + px
            val ty = dy + py
            if (tx < 0 || ty < 0 || tx >= bgW || ty >= bgH) continue
            val bi = ty * bgW + tx
            if (bi !in bg.indices) continue
            bg[bi] = if (a >= 250) {
                fg.toShort()
            } else {
                BacMessagePack.blend565(bg[bi].toInt() and 0xFFFF, fg, a).toShort()
            }
        }
    }
}

fun compositeIconOnBgCopy(
    bg: ShortArray,
    layerX: Int,
    layerY: Int,
    side: Int,
    frame: ShortArray,
    frameSide: Int,
    alpha: ByteArray?,
): ShortArray {
    val copy = bg.copyOf()
    compositeFrameOnBg(
        bg = copy,
        bgW = AppConfig.MSG_WIDTH,
        bgH = AppConfig.MSG_HEIGHT,
        frame = frame,
        frameW = frameSide,
        frameH = frameSide,
        alpha = alpha,
        dx = layerX,
        dy = layerY,
        dw = side,
        dh = side,
    )
    return copy
}

fun cropRect(pixels: ShortArray, srcW: Int, x: Int, y: Int, w: Int, h: Int): ShortArray {
    val out = ShortArray(w * h)
    for (row in 0 until h) {
        for (col in 0 until w) {
            val si = (y + row) * srcW + (x + col)
            out[row * w + col] = if (si in pixels.indices) pixels[si] else 0
        }
    }
    return out
}
