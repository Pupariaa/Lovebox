package com.tchy.boiteacoeur.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.platform.rememberBluetoothPermissionRequester
import com.tchy.boiteacoeur.resources.Res
import com.tchy.boiteacoeur.resources.logo_lovebox
import com.tchy.boiteacoeur.ui.components.AppBackground
import com.tchy.boiteacoeur.ui.theme.AuthGlow
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel
import org.jetbrains.compose.resources.painterResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: AppViewModel,
    onBle: () -> Unit,
    onPairing: () -> Unit,
    onComposer: () -> Unit,
    onHistory: () -> Unit,
    onSettings: () -> Unit,
    onLogout: () -> Unit,
) {
    LaunchedEffect(Unit) { vm.refreshState() }

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val hasDevice = vm.myDevice != null
    val hasPartner = vm.linkedTarget != null

    val requestBlePermissions = rememberBluetoothPermissionRequester { granted ->
        if (granted) {
            onBle()
        } else {
            vm.snackbarMessage = "Autorise le Bluetooth pour configurer ta boîte"
        }
    }

    Box(Modifier.fillMaxSize()) {
        AppBackground()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 32.dp),
        ) {
            if (!hasDevice) {
                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(600)) + slideInVertically(
                        initialOffsetY = { -it / 3 },
                        animationSpec = tween(600, easing = FastOutSlowInEasing),
                    ),
                ) {
                    WelcomeHero(progress = 0.5f, currentStep = 1)
                }

                Spacer(Modifier.height(28.dp))

                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(600, delayMillis = 120)),
                ) {
                    OnboardingStepCard(
                        step = 1,
                        title = "Configurer ta boîte",
                        description = "Connecte-la au WiFi via Bluetooth. Elle sera automatiquement associée à ton compte.",
                        icon = Icons.Default.Wifi,
                        done = false,
                        active = true,
                        onAction = { requestBlePermissions() },
                        actionLabel = "Commencer",
                    )
                }
            } else {
                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(500)) + slideInVertically { -it / 4 },
                ) {
                    HomeHeaderReady(hasPartner = hasPartner)
                }

                Spacer(Modifier.height(20.dp))

                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(500, delayMillis = 100)),
                ) {
                    StatusCard(vm = vm, hasDevice = true, hasPartner = hasPartner)
                }

                if (!hasPartner) {
                    Spacer(Modifier.height(16.dp))
                    AnimatedVisibility(
                        visible = visible,
                        enter = fadeIn(tween(500, delayMillis = 120)),
                    ) {
                        PartnerInviteCard(onPairing = onPairing)
                    }
                }

                Spacer(Modifier.height(20.dp))

                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(500, delayMillis = 150)),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (hasPartner) {
                            ActionCard(
                                title = "Envoyer un message",
                                subtitle = "Pour ${vm.linkedTarget?.deviceName ?: "ton partenaire"}",
                                icon = Icons.AutoMirrored.Filled.Send,
                                onClick = onComposer,
                                primary = true,
                            )
                            ActionCard(
                                title = "Historique",
                                subtitle = "Tes messages envoyés",
                                icon = Icons.Default.History,
                                onClick = onHistory,
                            )
                        } else {
                            ActionCard(
                                title = "Inviter ton partenaire",
                                subtitle = "Lie la boîte de la personne à qui tu veux écrire",
                                icon = Icons.Default.Favorite,
                                onClick = onPairing,
                                primary = true,
                            )
                        }
                        ActionCard(
                            title = "Réglages",
                            subtitle = "Nom de la boîte, région",
                            icon = Icons.Default.Settings,
                            onClick = onSettings,
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (hasDevice) {
                    TextButton(onClick = { requestBlePermissions() }) {
                        Icon(Icons.Default.Bluetooth, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(6.dp))
                        Text("WiFi")
                    }
                }
                TextButton(onClick = onLogout) {
                    Text("Déconnexion", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (vm.loading) {
                Spacer(Modifier.height(12.dp))
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.CenterHorizontally).size(28.dp),
                    color = RosePrimary,
                    strokeWidth = 2.dp,
                )
            }
        }
    }
}

@Composable
private fun WelcomeHero(progress: Float, currentStep: Int) {
    val infiniteTransition = rememberInfiniteTransition(label = "welcomeFloat")
    val floatOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "floatOffset",
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .alpha(0.4f)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(AuthGlow, Color.Transparent),
                        ),
                    ),
            )
            Image(
                painter = painterResource(Res.drawable.logo_lovebox),
                contentDescription = null,
                modifier = Modifier
                    .size(96.dp)
                    .offset(y = ((floatOffset - 0.5f) * 10).dp)
                    .scale(1f + (floatOffset - 0.5f) * 0.03f),
            )
        }

        Spacer(Modifier.height(20.dp))

        Text(
            text = "Ravi de te voir ici",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "Encore une étape pour envoyer ton premier message à cœur ouvert.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        Spacer(Modifier.height(24.dp))

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Étape $currentStep sur 2",
                        style = MaterialTheme.typography.labelLarge,
                        color = RosePrimary,
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                    color = RosePrimary,
                    trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                )
            }
        }
    }
}

@Composable
private fun HomeHeaderReady(hasPartner: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Image(
            painter = painterResource(Res.drawable.logo_lovebox),
            contentDescription = null,
            modifier = Modifier.size(56.dp),
        )
        Column {
            Text(
                text = if (hasPartner) "Tout est prêt" else "Ta boîte est prête",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = if (hasPartner) {
                    "Envoie un message à ton partenaire."
                } else {
                    "Invite ton partenaire quand tu veux pour envoyer des messages."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun PartnerInviteCard(onPairing: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
        border = androidx.compose.foundation.BorderStroke(1.dp, RosePrimary.copy(alpha = 0.35f)),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Partenaire non lié",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Tu peux explorer l'application dès maintenant. Pour envoyer des messages, invite la personne avec qui tu veux échanger.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = onPairing,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
            ) {
                Text("Inviter")
            }
        }
    }
}

@Composable
private fun StatusCard(
    vm: AppViewModel,
    hasDevice: Boolean,
    hasPartner: Boolean,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            StatusRow(
                label = "Ma boîte",
                value = vm.myDevice?.deviceName ?: "Non configurée",
                ok = hasDevice,
            )
            StatusRow(
                label = "En ligne",
                value = if (vm.myDevice?.online == true) "Oui" else "Non",
                ok = vm.myDevice?.online == true,
            )
            StatusRow(
                label = "Partenaire",
                value = vm.linkedTarget?.deviceName ?: "Non liée",
                ok = hasPartner,
            )
        }
    }
}

@Composable
private fun StatusRow(label: String, value: String, ok: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (ok) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = RosePrimary,
                    modifier = Modifier.size(16.dp),
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = if (ok) FontWeight.Medium else FontWeight.Normal,
            )
        }
    }
}

@Composable
private fun OnboardingStepCard(
    step: Int,
    title: String,
    description: String,
    icon: ImageVector,
    done: Boolean,
    active: Boolean,
    onAction: () -> Unit,
    actionLabel: String,
) {
    val borderAlpha = when {
        done -> 0.5f
        active -> 1f
        else -> 0.2f
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(
                alpha = if (active || done) 0.92f else 0.5f,
            ),
        ),
        border = androidx.compose.foundation.BorderStroke(
            width = if (active) 1.5.dp else 1.dp,
            color = RosePrimary.copy(alpha = borderAlpha),
        ),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Surface(
                    shape = CircleShape,
                    color = if (done) RosePrimary.copy(alpha = 0.2f) else RosePrimary.copy(alpha = 0.1f),
                ) {
                    Icon(
                        imageVector = if (done) Icons.Default.CheckCircle else icon,
                        contentDescription = null,
                        tint = if (done || active) RosePrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(12.dp).size(24.dp),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (!done && active) {
                Button(
                    onClick = onAction,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
                ) {
                    Text(actionLabel, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@Composable
private fun ActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit,
    primary: Boolean = false,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = if (primary) {
                RosePrimary.copy(alpha = 0.15f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f)
            },
        ),
        border = if (primary) {
            androidx.compose.foundation.BorderStroke(1.dp, RosePrimary.copy(alpha = 0.4f))
        } else {
            null
        },
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = RosePrimary,
                modifier = Modifier.size(26.dp),
            )
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
