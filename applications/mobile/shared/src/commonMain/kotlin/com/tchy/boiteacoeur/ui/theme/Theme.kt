package com.tchy.boiteacoeur.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val RosePrimary = Color(0xFFFF6B8A)
val RoseSecondary = Color(0xFFE85D75)
val RoseDark = Color(0xFFB84D62)
val WineAccent = Color(0xFF8B3A4A)
val CreamHighlight = Color(0xFFFFF5F0)
val CreamMuted = Color(0xFFF5E6DC)
val PlumBackground = Color(0xFF1A0C12)
val SurfaceDark = Color(0xFF241018)
val SurfaceCard = Color(0xFF2E141C)
val TextPrimary = Color(0xFFFFF0F2)
val TextMuted = Color(0xFFC9A8B0)
val AuthGlow = Color(0x50FF6B8A)

private val DarkColors = darkColorScheme(
    primary = RosePrimary,
    onPrimary = Color(0xFF2A0A12),
    secondary = RoseSecondary,
    tertiary = WineAccent,
    background = PlumBackground,
    surface = SurfaceDark,
    surfaceVariant = SurfaceCard,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextMuted,
    outline = Color(0xFF5A3848),
)

private val AppTypography = Typography(
    headlineLarge = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.5).sp,
    ),
    headlineMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.2.sp,
    ),
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun BoiteTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}
