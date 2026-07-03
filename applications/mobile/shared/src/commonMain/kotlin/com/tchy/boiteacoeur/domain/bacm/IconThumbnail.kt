package com.tchy.boiteacoeur.domain.bacm

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun IconThumbnail(
    ref: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    pixelSize: Int = 32,
) {
    var frame by remember(ref) { mutableStateOf<IconFrameData?>(null) }
    LaunchedEffect(ref) {
        frame = EmojiFrameLoader.loadThumbnail(ref, pixelSize)
    }
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        frame?.let { IconFrameImage(frame = it, modifier = Modifier.size(size)) }
    }
}
