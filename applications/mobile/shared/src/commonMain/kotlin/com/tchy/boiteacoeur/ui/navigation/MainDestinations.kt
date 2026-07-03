package com.tchy.boiteacoeur.ui.navigation

object MainDestinations {
    const val AUTH = "auth"
    const val TAB_HOME = "tab/home"
    const val TAB_COMPOSE = "tab/compose"
    const val TAB_CONTACTS = "tab/contacts"
    const val TAB_ACCOUNT = "tab/account"

    const val BLE = "ble"
    const val SETTINGS = "settings"
    const val PROFILE = "profile"
    const val HISTORY = "history"
    const val LEGAL_HUB = "legal-hub"
    const val LEGAL_SECTION = "legal/{section}"
    const val DEVICE_DETAIL = "device/{deviceId}"

    val tabs = listOf(TAB_HOME, TAB_COMPOSE, TAB_CONTACTS, TAB_ACCOUNT)

    fun deviceDetail(deviceId: Long) = "device/$deviceId"
    fun legalSection(section: String) = "legal/$section"
}

enum class MainTab(val route: String, val label: String) {
    Home(MainDestinations.TAB_HOME, "Accueil"),
    Compose(MainDestinations.TAB_COMPOSE, "Écrire"),
    Contacts(MainDestinations.TAB_CONTACTS, "Contacts"),
    Account(MainDestinations.TAB_ACCOUNT, "Compte"),
}
