package com.tchy.boiteacoeur.domain.bacm

data class IconFrameData(
    val pixels: ShortArray,
    val side: Int,
    val alpha: ByteArray? = null,
)

expect object EmojiFrameLoader {
    suspend fun loadFrames(ref: String, size: Int): List<IconFrameData>?
    suspend fun loadThumbnail(ref: String, size: Int = 32): IconFrameData?
}
