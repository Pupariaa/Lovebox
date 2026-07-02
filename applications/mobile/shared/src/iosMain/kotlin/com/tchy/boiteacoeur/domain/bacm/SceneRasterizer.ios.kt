package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene

actual class SceneRasterizer actual constructor() {
    actual fun rasterBackground(scene: MessageScene): ShortArray =
        emptyBg(BacMessagePack.hexTo565(scene.bgColor))

    actual fun bakeText(bg: ShortArray, layer: MessageLayer) {}

    actual fun bakeImage(bg: ShortArray, layer: MessageLayer, imageBytes: ByteArray) {}

    actual fun bakeIconFrame(bg: ShortArray, layer: MessageLayer, frame: ShortArray) {
        val side = layer.size
        for (y in 0 until side) {
            for (x in 0 until side) {
                val fg = frame.getOrElse(y * side + x) { 0 }
                val bi = (layer.y + y) * AppConfig.MSG_WIDTH + (layer.x + x)
                if (bi in bg.indices) bg[bi] = fg
            }
        }
    }
}
