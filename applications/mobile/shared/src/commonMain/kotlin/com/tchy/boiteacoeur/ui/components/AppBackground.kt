package com.tchy.boiteacoeur.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.theme.PlumBackground
import com.tchy.boiteacoeur.ui.theme.RosePrimary

@Composable
fun AppBackground(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1A0812),
                        PlumBackground,
                        Color(0xFF0D0208),
                    ),
                ),
            ),
    ) {
        val infiniteTransition = rememberInfiniteTransition(label = "bgGlow")
        val drift by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(6000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "drift",
        )

        Box(
            modifier = Modifier
                .size(280.dp)
                .offset(x = (-80 + drift * 40).dp, y = (-40 + drift * 30).dp)
                .alpha(0.18f)
                .clip(CircleShape)
                .background(RosePrimary),
        )
        Box(
            modifier = Modifier
                .size(220.dp)
                .align(Alignment.BottomEnd)
                .offset(x = (60 - drift * 30).dp, y = (-120 - drift * 20).dp)
                .alpha(0.12f)
                .clip(CircleShape)
                .background(Color(0xFFE85D75)),
        )
    }
}
