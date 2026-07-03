package com.tchy.boiteacoeur.domain.bacm

import com.tchy.boiteacoeur.AppConfig
import com.tchy.boiteacoeur.data.model.MessageLayer
import com.tchy.boiteacoeur.data.model.MessageScene

expect class SceneRasterizer() {
    fun rasterBackground(scene: MessageScene): ShortArray
    fun bakeText(bg: ShortArray, layer: MessageLayer)
    fun bakeImage(bg: ShortArray, layer: MessageLayer, imageBytes: ByteArray)
    fun bakeIconFrame(bg: ShortArray, layer: MessageLayer, frame: IconFrameData)
}

fun emptyBg(color565: Int): ShortArray = ShortArray(AppConfig.MSG_WIDTH * AppConfig.MSG_HEIGHT) { color565.toShort() }
