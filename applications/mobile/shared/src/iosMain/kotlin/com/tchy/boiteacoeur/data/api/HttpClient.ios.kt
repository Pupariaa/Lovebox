package com.tchy.boiteacoeur.data.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import io.ktor.client.plugins.HttpTimeout

actual fun createHttpClient(): HttpClient = HttpClient(Darwin) {
    install(HttpTimeout) {
        connectTimeoutMillis = HTTP_CONNECT_TIMEOUT_MS
        socketTimeoutMillis = HTTP_SOCKET_TIMEOUT_MS
        requestTimeoutMillis = HTTP_REQUEST_TIMEOUT_MS
    }
}

private const val HTTP_CONNECT_TIMEOUT_MS = 15_000L
private const val HTTP_SOCKET_TIMEOUT_MS = 30_000L
private const val HTTP_REQUEST_TIMEOUT_MS = 30_000L
