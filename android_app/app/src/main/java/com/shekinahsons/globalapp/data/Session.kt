package com.shekinahsons.globalapp.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable

@Serializable
data class Member(val id: String = "", val name: String = "", val email: String = "", val role: String = "member", val createdAt: String = "")

// The signed-in member. The token is kept on the phone (sealed with the
// Android Keystore) so members stay signed in between visits.
class Session(private val context: Context) {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    var member by mutableStateOf<Member?>(null)
        private set

    val firstName get() = member?.name?.trim()?.split(" ")?.firstOrNull().orEmpty()

    // What an admin has allowed this member to do (go live, moderate, publish).
    var permissions by mutableStateOf<List<String>>(prefs.getStringSet("permissions", emptySet()).orEmpty().toList())
        private set
    val canBroadcast get() = "live:broadcast" in permissions
    val canModerate get() = "live:moderate" in permissions
    val canPublish get() = "books:publish" in permissions
    // Admins (by their role in the database) get the admin console.
    val isAdmin get() = member?.role == "admin" || member?.role == "super_admin"

    private suspend fun loadPermissions() {
        runCatching { Api.decode<List<String>>(Api.get("/permissions/me")["permissions"]) }.onSuccess {
            permissions = it
            prefs.edit().putStringSet("permissions", it.toSet()).apply()
        }
    }

    init {
        val sealed = prefs.getString("token", null)
        val token = sealed?.let { runCatching { Vault.open(it) }.getOrNull() }
        if (token != null) {
            Api.token = token
            member = runCatching { Api.json.decodeFromString<Member>(prefs.getString("member", "") ?: "") }.getOrNull()
        }
    }

    private fun save(token: String, user: Member) {
        Api.token = token
        member = user
        prefs.edit().putString("token", Vault.seal(token)).putString("member", Api.json.encodeToString(Member.serializer(), user)).apply()
    }

    suspend fun signIn(email: String, password: String) {
        val res = Api.post("/auth/login", mapOf("email" to email.trim(), "password" to password))
        save(Api.decode<String>(res["token"]), Api.decode(res["user"]))
        loadPermissions()
    }

    suspend fun register(name: String, email: String, password: String) {
        val res = Api.post("/auth/register", mapOf("name" to name.trim(), "email" to email.trim(), "password" to password))
        save(Api.decode<String>(res["token"]), Api.decode(res["user"]))
    }

    suspend fun requestReset(email: String) { Api.post("/auth/password-reset/request", mapOf("email" to email.trim())) }

    suspend fun confirmReset(email: String, code: String, password: String) {
        Api.post("/auth/password-reset/confirm", mapOf("email" to email.trim(), "code" to code.trim(), "newPassword" to password))
    }

    suspend fun changePassword(current: String, next: String) {
        Api.patch("/auth/password", mapOf("currentPassword" to current, "newPassword" to next))
    }

    // Refreshes the profile; a rejected token (expired, account disabled) signs out.
    suspend fun refresh() {
        if (Api.token == null) return
        try {
            val res = Api.get("/auth/me")
            member = Api.decode(res["user"])
            loadPermissions()
        } catch (e: ApiException) {
            if (e.status == 401) signOut()
        }
    }

    fun signOut() {
        Api.token = null
        member = null
        permissions = emptyList()
        prefs.edit().clear().apply()
    }
}
