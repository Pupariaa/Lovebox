package com.tchy.boiteacoeur.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tchy.boiteacoeur.ui.screens.AuthScreen
import com.tchy.boiteacoeur.ui.screens.BleSetupScreen
import com.tchy.boiteacoeur.ui.screens.ClaimScreen
import com.tchy.boiteacoeur.ui.screens.ComposerScreen
import com.tchy.boiteacoeur.ui.screens.HistoryScreen
import com.tchy.boiteacoeur.ui.screens.HomeScreen
import com.tchy.boiteacoeur.ui.screens.PairingScreen
import com.tchy.boiteacoeur.ui.screens.SettingsScreen
import com.tchy.boiteacoeur.ui.theme.BoiteTheme
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

object Routes {
    const val AUTH = "auth"
    const val HOME = "home"
    const val BLE = "ble"
    const val CLAIM = "claim"
    const val PAIRING = "pairing"
    const val COMPOSER = "composer"
    const val HISTORY = "history"
    const val SETTINGS = "settings"
}

@Composable
fun AppRoot(initialInviteToken: String? = null, vm: AppViewModel = remember { AppViewModel() }) {
    BoiteTheme {
        val nav = rememberNavController()
        val snackbar = remember { SnackbarHostState() }

        LaunchedEffect(vm.snackbarMessage) {
            vm.snackbarMessage?.let {
                snackbar.showSnackbar(it)
                vm.clearSnackbar()
            }
        }

        LaunchedEffect(initialInviteToken) {
            if (!initialInviteToken.isNullOrBlank()) {
                vm.pendingInviteToken = initialInviteToken
            }
        }

        LaunchedEffect(Unit) {
            val loggedIn = vm.bootstrap()
            nav.navigate(if (loggedIn) Routes.HOME else Routes.AUTH) {
                popUpTo(0)
            }
        }

        LaunchedEffect(vm.forceAuth) {
            if (vm.forceAuth) {
                vm.forceAuth = false
                nav.navigate(Routes.AUTH) { popUpTo(0) }
            }
        }

        Scaffold(
            modifier = Modifier.fillMaxSize(),
            snackbarHost = { SnackbarHost(snackbar) },
        ) { padding ->
            val backStack by nav.currentBackStackEntryAsState()
            val isAuth = backStack?.destination?.route == Routes.AUTH
            val isHome = backStack?.destination?.route == Routes.HOME
            NavHost(
                navController = nav,
                startDestination = Routes.AUTH,
                modifier = Modifier.padding(if (isAuth || isHome) PaddingValues(0.dp) else padding),
            ) {
                composable(Routes.AUTH) {
                    AuthScreen(
                        vm = vm,
                        onAuthenticated = {
                            nav.navigate(Routes.HOME) { popUpTo(Routes.AUTH) { inclusive = true } }
                        },
                    )
                }
                composable(Routes.HOME) {
                    HomeScreen(
                        vm = vm,
                        onBle = { nav.navigate(Routes.BLE) },
                        onPairing = { nav.navigate(Routes.PAIRING) },
                        onComposer = { nav.navigate(Routes.COMPOSER) },
                        onHistory = { nav.navigate(Routes.HISTORY) },
                        onSettings = { nav.navigate(Routes.SETTINGS) },
                        onLogout = {
                            vm.logout()
                            nav.navigate(Routes.AUTH) { popUpTo(0) }
                        },
                    )
                }
                composable(Routes.BLE) {
                    BleSetupScreen(
                        vm = vm,
                        onDone = {
                            vm.refreshState()
                            nav.popBackStack()
                        },
                    )
                }
                composable(Routes.CLAIM) {
                    ClaimScreen(vm = vm, onDone = { nav.popBackStack() })
                }
                composable(Routes.PAIRING) {
                    PairingScreen(vm = vm, onDone = { nav.popBackStack() })
                }
                composable(Routes.COMPOSER) {
                    ComposerScreen(vm = vm, onSent = { nav.popBackStack() })
                }
                composable(Routes.HISTORY) {
                    HistoryScreen(vm = vm, onBack = { nav.popBackStack() })
                }
                composable(Routes.SETTINGS) {
                    SettingsScreen(vm = vm, onBack = { nav.popBackStack() })
                }
            }
        }
    }
}
