package com.tchy.boiteacoeur

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.tchy.boiteacoeur.ui.AppRoot

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val inviteToken = intent?.data?.lastPathSegment
        setContent {
            AppRoot(initialInviteToken = inviteToken)
        }
    }
}
