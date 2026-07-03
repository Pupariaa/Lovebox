package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene

actual class SceneRasterizer actual constructor() {
    actual fun rasterBackground(scene: MessageScene): ShortArray =
        emptyBg(BacMessagePack.hexTo565(scene.bgColor))

    actual fun bakeText(bg: ShortArray, layer: MessageLayer) {}

    actual fun bakeImage(bg: ShortArray, layer: MessageLayer, imageBytes: ByteArray) {}

    actual fun bakeIconFrame(bg: ShortArray, layer: MessageLayer, frame: IconFrameData) {
        compositeFrameOnBg(
            bg = bg,
            bgW = AppConfig.MSG_WIDTH,
            bgH = AppConfig.MSG_HEIGHT,
            frame = frame.pixels,
            frameW = frame.side,
            frameH = frame.side,
            alpha = frame.alpha,
            dx = layer.x,
            dy = layer.y,
            dw = layer.size,
            dh = layer.size,
        )
    }
}
