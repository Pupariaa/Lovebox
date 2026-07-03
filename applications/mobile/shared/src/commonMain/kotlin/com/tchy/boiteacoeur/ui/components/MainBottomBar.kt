package com.tchy.boiteacoeur.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import com.tchy.boiteacoeur.ui.navigation.MainTab
import com.tchy.boiteacoeur.ui.theme.RosePrimary

@Composable
fun MainBottomBar(
    currentRoute: String?,
    onTabSelected: (MainTab) -> Unit,
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
    ) {
        MainTab.entries.forEach { tab ->
            val selected = currentRoute == tab.route
            NavigationBarItem(
                selected = selected,
                onClick = { onTabSelected(tab) },
                icon = {
                    Icon(
                        imageVector = tab.icon(),
                        contentDescription = tab.label,
                    )
                },
                label = { Text(tab.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = RosePrimary,
                    selectedTextColor = RosePrimary,
                    indicatorColor = RosePrimary.copy(alpha = 0.18f),
                ),
            )
        }
    }
}

private fun MainTab.icon(): ImageVector = when (this) {
    MainTab.Home -> Icons.Default.Home
    MainTab.Compose -> Icons.AutoMirrored.Filled.Send
    MainTab.Contacts -> Icons.Default.Favorite
    MainTab.Account -> Icons.Default.Person
}
