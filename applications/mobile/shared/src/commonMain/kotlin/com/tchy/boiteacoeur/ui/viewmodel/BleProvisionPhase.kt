package com.tchy.boiteacoeur.ui.viewmodel

enum class BleProvisionPhase {
    Idle,
    Connecting,
    SendingWifi,
    WaitingForBox,
    LinkingAccount,
    Success,
    Failed,
}
