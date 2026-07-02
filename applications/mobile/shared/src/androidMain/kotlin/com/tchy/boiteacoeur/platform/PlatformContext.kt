package com.tchy.boiteacoeur.platform

import android.content.Context

object PlatformContext {
    lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
    }
}
