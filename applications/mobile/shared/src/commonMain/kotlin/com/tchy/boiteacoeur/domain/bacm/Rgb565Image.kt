package com.tchy.boiteacoeur.domain.bacm

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.tchy.boiteacoeur.AppConfig

@Composable
expect fun Rgb565Image(
    pixels: ShortArray,
    modifier: Modifier = Modifier,
    width: Int = AppConfig.MSG_WIDTH,
    height: Int = AppConfig.MSG_HEIGHT,
    alpha: ByteArray? = null,
)

@Composable
fun IconFrameImage(
    frame: IconFrameData,
    modifier: Modifier = Modifier,
) {
    Rgb565Image(
        pixels = frame.pixels,
        modifier = modifier,
        width = frame.side,
        height = frame.side,
        alpha = frame.alpha,
    )
}
