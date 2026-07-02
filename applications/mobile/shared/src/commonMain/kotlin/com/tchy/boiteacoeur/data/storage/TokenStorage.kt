package com.tchy.boiteacoeur.data.storage

expect class TokenStorage() {
    fun getAccessToken(): String?
    fun setAccessToken(token: String?)
    fun getRefreshToken(): String?
    fun setRefreshToken(token: String?)
    fun clear()
}
