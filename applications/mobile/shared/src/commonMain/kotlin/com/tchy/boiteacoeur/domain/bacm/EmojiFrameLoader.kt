package com.tchy.boiteacoeur.domain.bacm

expect object EmojiFrameLoader {
    suspend fun loadFrames(ref: String, size: Int): List<ShortArray>?
}
