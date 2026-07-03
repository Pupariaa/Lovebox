package com.tchy.boiteacoeur.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tchy.boiteacoeur.ui.components.MainBottomBar
import com.tchy.boiteacoeur.ui.navigation.MainDestinations
import com.tchy.boiteacoeur.ui.screens.AccountHubScreen
import com.tchy.boiteacoeur.ui.screens.AccountScreen
import com.tchy.boiteacoeur.ui.screens.AuthScreen
import com.tchy.boiteacoeur.ui.screens.BleSetupScreen
import com.tchy.boiteacoeur.ui.screens.ComposerScreen
import com.tchy.boiteacoeur.ui.screens.ContactsTabScreen
import com.tchy.boiteacoeur.ui.screens.DeviceDetailScreen
import com.tchy.boiteacoeur.ui.screens.HistoryScreen
import com.tchy.boiteacoeur.ui.screens.HomeScreen
import com.tchy.boiteacoeur.ui.screens.LegalHubScreen
import com.tchy.boiteacoeur.ui.screens.LegalScreen
import com.tchy.boiteacoeur.ui.screens.SettingsScreen
import com.tchy.boiteacoeur.ui.theme.BoiteTheme
import com.tchy.boiteacoeur.ui.viewmodel.AppViewModel

@Composable
fun AppRoot(vm: AppViewModel = remember { AppViewModel() }) {
    BoiteTheme {
        val nav = rememberNavController()
        val snackbar = remember { SnackbarHostState() }
        val snackbarMessage by vm.snackbarMessage.collectAsState()

        LaunchedEffect(snackbarMessage) {
            snackbarMessage?.let {
                snackbar.showSnackbar(it)
                vm.clearSnackbar()
            }
        }

        LaunchedEffect(Unit) {
            val loggedIn = vm.bootstrap()
            nav.navigate(if (loggedIn) MainDestinations.TAB_HOME else MainDestinations.AUTH) {
                popUpTo(0)
            }
        }

        LaunchedEffect(vm.forceAuth) {
            if (vm.forceAuth) {
                vm.forceAuth = false
                nav.navigate(MainDestinations.AUTH) { popUpTo(0) }
            }
        }

        val backStack by nav.currentBackStackEntryAsState()
        val currentRoute = backStack?.destination?.route
        val showBottomBar = currentRoute in MainDestinations.tabs

        Scaffold(
            modifier = Modifier.fillMaxSize(),
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                if (showBottomBar) {
                    MainBottomBar(
                        currentRoute = currentRoute,
                        onTabSelected = { tab ->
                            nav.navigate(tab.route) {
                                popUpTo(MainDestinations.TAB_HOME) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                    )
                }
            },
        ) { padding ->
            NavHost(
                navController = nav,
                startDestination = MainDestinations.AUTH,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                composable(MainDestinations.AUTH) {
                    AuthScreen(
                        vm = vm,
                        onAuthenticated = {
                            nav.navigate(MainDestinations.TAB_HOME) {
                                popUpTo(MainDestinations.AUTH) { inclusive = true }
                            }
                        },
                    )
                }

                composable(MainDestinations.TAB_HOME) {
                    HomeScreen(
                        vm = vm,
                        onBle = { nav.navigate(MainDestinations.BLE) },
                        onGoContacts = { nav.navigate(MainDestinations.TAB_CONTACTS) },
                        onGoCompose = { nav.navigate(MainDestinations.TAB_COMPOSE) },
                        onDeviceDetail = { id -> nav.navigate(MainDestinations.deviceDetail(id)) },
                    )
                }

                composable(MainDestinations.TAB_COMPOSE) {
                    ComposerScreen(
                        vm = vm,
                        embedded = true,
                        onSent = { nav.navigate(MainDestinations.TAB_HOME) },
                    )
                }

                composable(MainDestinations.TAB_CONTACTS) {
                    ContactsTabScreen(vm = vm)
                }

                composable(MainDestinations.TAB_ACCOUNT) {
                    AccountHubScreen(
                        vm = vm,
                        onProfile = { nav.navigate(MainDestinations.PROFILE) },
                        onSettings = { nav.navigate(MainDestinations.SETTINGS) },
                        onDeviceDetail = { id -> nav.navigate(MainDestinations.deviceDetail(id)) },
                        onHistory = { nav.navigate(MainDestinations.HISTORY) },
                        onBle = { nav.navigate(MainDestinations.BLE) },
                        onLegal = { nav.navigate(MainDestinations.LEGAL_HUB) },
                        onLogout = {
                            vm.logout()
                            nav.navigate(MainDestinations.AUTH) { popUpTo(0) }
                        },
                    )
                }

                composable(MainDestinations.BLE) {
                    BleSetupScreen(
                        vm = vm,
                        onDone = {
                            vm.refreshState()
                            nav.popBackStack()
                        },
                    )
                }

                composable(MainDestinations.SETTINGS) {
                    SettingsScreen(vm = vm, onBack = { nav.popBackStack() })
                }

                composable(MainDestinations.PROFILE) {
                    AccountScreen(vm = vm, onBack = { nav.popBackStack() })
                }

                composable(MainDestinations.HISTORY) {
                    HistoryScreen(vm = vm, onBack = { nav.popBackStack() })
                }

                composable(MainDestinations.LEGAL_HUB) {
                    LegalHubScreen(
                        onBack = { nav.popBackStack() },
                        onOpenSection = { section -> nav.navigate(MainDestinations.legalSection(section)) },
                    )
                }

                composable(
                    route = MainDestinations.LEGAL_SECTION,
                    arguments = listOf(navArgument("section") { type = NavType.StringType }),
                ) { entry ->
                    val section = entry.arguments?.getString("section") ?: "legal"
                    LegalScreen(section = section, onBack = { nav.popBackStack() })
                }

                composable(
                    route = MainDestinations.DEVICE_DETAIL,
                    arguments = listOf(navArgument("deviceId") { type = NavType.LongType }),
                ) { entry ->
                    val deviceId = entry.arguments?.getLong("deviceId") ?: 0L
                    DeviceDetailScreen(
                        vm = vm,
                        deviceId = deviceId,
                        onBack = { nav.popBackStack() },
                    )
                }
            }
        }
    }
}
