package com.tchy.boiteacoeur.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.resources.Res
import com.tchy.boiteacoeur.resources.logo_lovebox
import com.tchy.boiteacoeur.ui.theme.AuthGlow
import com.tchy.boiteacoeur.ui.theme.PlumBackground
import com.tchy.boiteacoeur.ui.theme.RosePrimary
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel
import org.jetbrains.compose.resources.painterResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(vm: AppViewModel, onAuthenticated: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableIntStateOf(0) }
    var contentVisible by remember { mutableStateOf(false) }

    val registerMode = selectedTab == 1
    val emailValid = email.contains("@") && email.contains(".")
    val passwordValid = password.length >= 8
    val canSubmit = !vm.loading && emailValid && passwordValid

    LaunchedEffect(Unit) {
        contentVisible = true
    }

    Box(
        modifier = Modifier
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
        AuthBackgroundGlow()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 48.dp, bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AnimatedVisibility(
                visible = contentVisible,
                enter = fadeIn(tween(700)) + slideInVertically(
                    initialOffsetY = { -it / 3 },
                    animationSpec = tween(700, easing = FastOutSlowInEasing),
                ),
            ) {
                AuthHeader()
            }

            Spacer(Modifier.height(36.dp))

            AnimatedVisibility(
                visible = contentVisible,
                enter = fadeIn(tween(700, delayMillis = 150)),
            ) {
                SingleChoiceSegmentedButtonRow(
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    SegmentedButton(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                        label = { Text("Connexion") },
                    )
                    SegmentedButton(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                        label = { Text("Inscription") },
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            AnimatedVisibility(
                visible = contentVisible,
                enter = fadeIn(tween(700, delayMillis = 200)),
            ) {
                Text(
                    text = if (registerMode) {
                        "Rejoins la boîte à cœur de quelqu'un que tu aimes."
                    } else {
                        "Content de te revoir."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(24.dp))

            AnimatedContent(
                targetState = registerMode,
                transitionSpec = {
                    if (targetState) {
                        (fadeIn(tween(300)) + slideInHorizontally { it / 3 })
                            .togetherWith(fadeOut(tween(200)) + slideOutHorizontally { -it / 3 })
                    } else {
                        (fadeIn(tween(300)) + slideInHorizontally { -it / 3 })
                            .togetherWith(fadeOut(tween(200)) + slideOutHorizontally { it / 3 })
                    }
                },
                label = "authForm",
            ) { isRegister ->
                AuthFormCard(
                    email = email,
                    onEmailChange = { email = it },
                    password = password,
                    onPasswordChange = { password = it },
                    passwordVisible = passwordVisible,
                    onPasswordVisibilityToggle = { passwordVisible = !passwordVisible },
                    registerMode = isRegister,
                    onSubmit = {
                        if (isRegister) vm.register(email, password, onAuthenticated)
                        else vm.login(email, password, onAuthenticated)
                    },
                    canSubmit = canSubmit,
                    loading = vm.loading,
                    emailValid = emailValid,
                    passwordValid = passwordValid,
                )
            }
        }
    }
}

@Composable
private fun AuthHeader() {
    val infiniteTransition = rememberInfiniteTransition(label = "logoFloat")
    val floatOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "floatOffset",
    )
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.65f,
        animationSpec = infiniteRepeatable(
            animation = tween(3200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glowAlpha",
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .alpha(glowAlpha)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(AuthGlow, Color.Transparent),
                        ),
                    ),
            )
            Image(
                painter = painterResource(Res.drawable.logo_lovebox),
                contentDescription = "Boîte à Cœur",
                modifier = Modifier
                    .size(120.dp)
                    .offset(y = ((floatOffset - 0.5f) * 12).dp)
                    .scale(1f + (floatOffset - 0.5f) * 0.04f),
            )
        }

        Spacer(Modifier.height(16.dp))

        Text(
            text = "Boîte à Cœur",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )

        Spacer(Modifier.height(6.dp))

        Text(
            text = "Envoie des messages qui comptent",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun AuthBackgroundGlow() {
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

    Box(modifier = Modifier.fillMaxSize()) {
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

@Composable
private fun AuthFormCard(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    passwordVisible: Boolean,
    onPasswordVisibilityToggle: () -> Unit,
    registerMode: Boolean,
    onSubmit: () -> Unit,
    canSubmit: Boolean,
    loading: Boolean,
    emailValid: Boolean,
    passwordValid: Boolean,
) {
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = RosePrimary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = RosePrimary,
        cursorColor = RosePrimary,
    )

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
        tonalElevation = 2.dp,
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = if (registerMode) "Créer un compte" else "Se connecter",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )

            OutlinedTextField(
                value = email,
                onValueChange = onEmailChange,
                label = { Text("Adresse e-mail") },
                leadingIcon = {
                    Icon(Icons.Default.Email, contentDescription = null)
                },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                colors = fieldColors,
                isError = email.isNotBlank() && !emailValid,
                supportingText = {
                    if (email.isNotBlank() && !emailValid) {
                        Text("Adresse e-mail invalide")
                    }
                },
            )

            OutlinedTextField(
                value = password,
                onValueChange = onPasswordChange,
                label = { Text("Mot de passe") },
                leadingIcon = {
                    Icon(Icons.Default.Lock, contentDescription = null)
                },
                trailingIcon = {
                    IconButton(onClick = onPasswordVisibilityToggle) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (passwordVisible) "Masquer" else "Afficher",
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = if (passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = { if (canSubmit) onSubmit() },
                ),
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                colors = fieldColors,
                isError = password.isNotBlank() && !passwordValid,
                supportingText = {
                    if (password.isNotBlank() && !passwordValid) {
                        Text("Minimum 8 caractères")
                    }
                },
            )

            Button(
                onClick = onSubmit,
                enabled = canSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = RosePrimary,
                    disabledContainerColor = RosePrimary.copy(alpha = 0.35f),
                ),
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(
                        text = if (registerMode) "Créer mon compte" else "Continuer",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
    }
}
