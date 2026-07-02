package com.tchy.boiteacoeur.data.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

actual fun createHttpClient(): HttpClient = HttpClient(OkHttp) {
    engine {
        config {
            retryOnConnectionFailure(true)
        }
    }
}
