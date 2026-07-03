package com.tchy.boiteacoeur.domain.bacm

data class BundledEmoji(
    val ref: String,
    val label: String,
    val folder: String,
    val animated: Boolean = true,
)

val BUNDLED_EMOJIS = listOf(
    BundledEmoji("emoji:1f48c", "Lettre", "1f48c"),
    BundledEmoji("emoji:1f329-fe0f", "Eclair", "1f329_fe0f"),
    BundledEmoji("emoji:1f389", "Fete", "1f389_w_w_mqzx3u1111"),
    BundledEmoji("emoji:1f446", "Doigt", "1f446"),
    BundledEmoji("emoji:1f614", "Pensif", "1f614_w_w_mqzxkguj1c"),
    BundledEmoji("emoji:1f42c", "Panda", "1f42c_w_w_mqzxq5g01i"),
    BundledEmoji("emoji:1f446-1f3fb", "Doigt clair", "1f446_1f3fb_w_w_mqzwncruk"),
    BundledEmoji("glyphs:sparkles", "Etincelles", "glyphs_sparkles", animated = false),
    BundledEmoji("glyphs:arrows_round", "Fleches", "glyphs_arrows_round", animated = false),
    BundledEmoji("glyphs:comment_info", "Info", "glyphs_comment_info", animated = false),
    BundledEmoji("glyphs:watch", "Montre", "glyphs_watch", animated = false),
)

fun bundledEmojiFolders(): Set<String> = BUNDLED_EMOJIS.map { it.folder }.toSet()

val COMPOSER_COLOR_PALETTE = listOf(
    "#120310",
    "#2E141C",
    "#8B3A4A",
    "#FF6B8A",
    "#FFF5F0",
    "#E85D75",
    "#4A3040",
    "#FFFFFF",
    "#E09090",
    "#B84D62",
)
