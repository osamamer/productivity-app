package org.osama.solife.boundaries

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Single source of truth for everything that has to survive process death and be trusted by
 * the accessibility service even when no JavaScript is running. Backed by
 * EncryptedSharedPreferences (Android Keystore) so the password hashes and salts aren't sitting
 * in a plain XML file under /data/data.
 */
object BoundariesPrefs {
    private const val PREFS_NAME = "boundaries_secure_prefs"

    private const val KEY_UNLOCK_PW_HASH = "unlock_pw_hash"
    private const val KEY_UNLOCK_PW_SALT = "unlock_pw_salt"
    private const val KEY_MASTER_PW_HASH = "master_pw_hash"
    private const val KEY_MASTER_PW_SALT = "master_pw_salt"
    private const val KEY_RULES = "app_rules_json"
    private const val KEY_PAUSED_UNTIL = "paused_until"
    private const val KEY_INDEFINITELY_DISABLED = "indefinitely_disabled"

    const val PAUSE_DURATION_MS = 5 * 60 * 1000L

    @Volatile private var prefs: SharedPreferences? = null

    private fun get(context: Context): SharedPreferences {
        return prefs ?: synchronized(this) {
            prefs ?: run {
                val masterKey = MasterKey.Builder(context.applicationContext)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    context.applicationContext,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                ).also { prefs = it }
            }
        }
    }

    fun hasPasswordsSet(context: Context): Boolean {
        val p = get(context)
        return p.contains(KEY_UNLOCK_PW_HASH) && p.contains(KEY_MASTER_PW_HASH)
    }

    fun setPasswords(context: Context, unlockPw: String, masterPw: String) {
        val unlockSalt = PasswordHasher.randomSaltBase64()
        val masterSalt = PasswordHasher.randomSaltBase64()
        get(context).edit()
            .putString(KEY_UNLOCK_PW_HASH, PasswordHasher.hash(unlockPw, unlockSalt))
            .putString(KEY_UNLOCK_PW_SALT, unlockSalt)
            .putString(KEY_MASTER_PW_HASH, PasswordHasher.hash(masterPw, masterSalt))
            .putString(KEY_MASTER_PW_SALT, masterSalt)
            .apply()
    }

    private fun verify(context: Context, hashKey: String, saltKey: String, pw: String): Boolean {
        val p = get(context)
        val hash = p.getString(hashKey, null) ?: return false
        val salt = p.getString(saltKey, null) ?: return false
        return PasswordHasher.verify(pw, salt, hash)
    }

    fun verifyUnlockPassword(context: Context, pw: String) = verify(context, KEY_UNLOCK_PW_HASH, KEY_UNLOCK_PW_SALT, pw)

    fun verifyMasterPassword(context: Context, pw: String) = verify(context, KEY_MASTER_PW_HASH, KEY_MASTER_PW_SALT, pw)

    private fun setPassword(context: Context, hashKey: String, saltKey: String, newPw: String) {
        val salt = PasswordHasher.randomSaltBase64()
        get(context).edit()
            .putString(hashKey, PasswordHasher.hash(newPw, salt))
            .putString(saltKey, salt)
            .apply()
    }

    fun setUnlockPassword(context: Context, newPw: String) = setPassword(context, KEY_UNLOCK_PW_HASH, KEY_UNLOCK_PW_SALT, newPw)

    fun setMasterPassword(context: Context, newPw: String) = setPassword(context, KEY_MASTER_PW_HASH, KEY_MASTER_PW_SALT, newPw)

    // Parsed rules, cached in memory: the accessibility service consults them on every window
    // change and once a second while a ruled app is open, so don't decrypt+parse JSON each time.
    @Volatile private var rulesCache: Map<String, AppRule>? = null

    /** Per-app rules (block / time limit / open limit / schedule), keyed by package name. */
    fun getRules(context: Context): Map<String, AppRule> {
        rulesCache?.let { return it }
        synchronized(this) {
            rulesCache?.let { return it }
            val json = get(context).getString(KEY_RULES, null)
            val rules = if (json == null) emptyList() else try {
                AppRule.listFromJson(json)
            } catch (e: Exception) {
                android.util.Log.e("BoundariesPrefs", "Stored rules are unreadable; treating as none", e)
                emptyList()
            }
            return rules.associateBy { it.pkg }.also { rulesCache = it }
        }
    }

    fun setRules(context: Context, rules: Collection<AppRule>) {
        synchronized(this) {
            get(context).edit().putString(KEY_RULES, AppRule.listToJson(rules)).apply()
            rulesCache = rules.associateBy { it.pkg }
        }
    }

    fun getPausedUntil(context: Context): Long = get(context).getLong(KEY_PAUSED_UNTIL, 0L)

    fun setPausedUntil(context: Context, untilMillis: Long) {
        get(context).edit().putLong(KEY_PAUSED_UNTIL, untilMillis).apply()
    }

    fun isIndefinitelyDisabled(context: Context): Boolean = get(context).getBoolean(KEY_INDEFINITELY_DISABLED, false)

    fun setIndefinitelyDisabled(context: Context, disabled: Boolean) {
        get(context).edit().putBoolean(KEY_INDEFINITELY_DISABLED, disabled).apply()
    }

    /**
     * Whether enforcement should run right now. Self-heals an expired pause (the AlarmManager
     * callback is the normal path back to active; this is a fallback in case the alarm was
     * missed or delayed by Doze).
     */
    fun isEnforcementActive(context: Context): Boolean {
        if (isIndefinitelyDisabled(context)) return false
        val until = getPausedUntil(context)
        if (until != 0L) {
            if (System.currentTimeMillis() >= until) {
                setPausedUntil(context, 0L)
                return true
            }
            return false
        }
        return true
    }
}
