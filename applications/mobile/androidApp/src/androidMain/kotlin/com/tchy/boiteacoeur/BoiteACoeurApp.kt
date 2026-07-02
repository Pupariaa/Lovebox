package com.tchy.boiteacoeur

import android.app.Application
import com.tchy.boiteacoeur.platform.PlatformContext

class BoiteACoeurApp : Application() {
    override fun onCreate() {
        super.onCreate()
        PlatformContext.init(this)
    }
}
