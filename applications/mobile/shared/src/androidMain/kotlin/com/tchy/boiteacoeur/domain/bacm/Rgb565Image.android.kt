package com.tchy.boiteacoeur.domain.bacm

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale

@Composable
actual fun Rgb565Image(
    pixels: ShortArray,
    modifier: Modifier,
    width: Int,
    height: Int,
    alpha: ByteArray?,
) {
    val bitmap = remember(pixels, width, height, alpha) {
        Rgb565Bitmap.fromPixels(pixels, width, height, alpha)
    }
    Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = null,
        modifier = modifier.fillMaxWidth(),
        contentScale = ContentScale.FillBounds,
    )
}
