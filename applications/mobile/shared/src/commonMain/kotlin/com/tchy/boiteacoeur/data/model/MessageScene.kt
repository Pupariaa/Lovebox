package com.tchy.boiteacoeur.data.model

import kotlinx.serialization.Serializable

@Serializable
data class MessageScene(
    val bgType: String = "color",
    val bgColor: String = "#120310",
    val bgImageBytes: ByteArray? = null,
    val layers: List<MessageLayer> = emptyList(),
)

@Serializable
data class MessageLayer(
    val id: String,
    val type: String,
    val text: String = "",
    val x: Int = 0,
    val y: Int = 0,
    val w: Int = 280,
    val h: Int = 36,
    val color: String = "#e09090",
    val fontSize: Int = 22,
    val align: String = "center",
    val ref: String = "",
    val size: Int = 64,
    val anim: Boolean = false,
    val fps: Int = 12,
    val imageBytes: ByteArray? = null,
    val hidden: Boolean = false,
)
