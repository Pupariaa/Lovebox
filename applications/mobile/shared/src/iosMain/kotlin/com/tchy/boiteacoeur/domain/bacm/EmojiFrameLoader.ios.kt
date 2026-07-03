package com.tchy.boiteacoeur.domain.bacm

actual object EmojiFrameLoader {
    actual suspend fun loadFrames(ref: String, size: Int): List<IconFrameData>? = null
    actual suspend fun loadThumbnail(ref: String, size: Int): IconFrameData? = null
}
