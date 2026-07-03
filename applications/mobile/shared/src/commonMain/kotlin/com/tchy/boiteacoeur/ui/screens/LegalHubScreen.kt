package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.components.NavMenuGroup
import com.tchy.boiteacoeur.ui.components.NavMenuItem

@Composable
fun LegalHubScreen(
    onBack: () -> Unit,
    onOpenSection: (String) -> Unit,
) {
    AppScaffold(title = "Informations légales", onBack = onBack) { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            NavMenuGroup {
                NavMenuItem(
                    title = "Conditions d'utilisation",
                    subtitle = "Règles d'usage du service",
                    icon = Icons.Default.Description,
                    showDivider = false,
                    onClick = { onOpenSection("terms") },
                )
                NavMenuItem(
                    title = "Politique de confidentialité",
                    subtitle = "Données collectées et droits",
                    icon = Icons.Default.Policy,
                    onClick = { onOpenSection("privacy") },
                )
                NavMenuItem(
                    title = "Mentions légales",
                    subtitle = "Éditeur et hébergement",
                    icon = Icons.Default.VerifiedUser,
                    onClick = { onOpenSection("legal") },
                )
            }
        }
    }
}
