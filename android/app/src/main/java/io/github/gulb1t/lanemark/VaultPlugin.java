package io.github.gulb1t.lanemark;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import static androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG;
import static androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK;
import static androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL;

/**
 * Keeps short secrets (the Lanemark sign-in) encrypted with AES keys that live in the phone's secure hardware
 * (Android Keystore), so they can't be copied off the phone.
 *
 * A "locked" value needs a fingerprint, face or screen-lock check to read:
 * - "bio": phones with strong biometrics. The key itself only works after the check (the check unlocks the
 *   cipher), and adding a new fingerprint destroys it, so only the person who turned it on can read the value.
 * - "gate": phones whose only biometric is weak (most face unlock). Android won't tie a key to those, so the value
 *   is encrypted like an unlocked one and the check guards reading it.
 *
 * Errors reject with a code the app understands: cancelled, invalidated, unavailable, lockout, failed.
 */
@CapacitorPlugin(name = "Vault")
public class VaultPlugin extends Plugin {

    private static final String PREFS = "lanemark_vault";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String PLAIN_KEY = "lanemark.vault.plain";
    private static final String BIO_KEY = "lanemark.vault.bio";
    private static final String TRANSFORM = "AES/GCM/NoPadding";

    private interface Done {
        void run(Cipher cipher) throws Exception;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // What the phone can do

    private boolean can(int authenticators) {
        return BiometricManager.from(getContext()).canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** Fingerprint or strong face, plus the screen lock as a fallback where Android allows it with a key (11+). */
    private int strongAuthenticators() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? BIOMETRIC_STRONG | DEVICE_CREDENTIAL : BIOMETRIC_STRONG;
    }

    private int gateAuthenticators() {
        return BIOMETRIC_WEAK | DEVICE_CREDENTIAL;
    }

    @PluginMethod
    public void status(PluginCall call) {
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        JSObject res = new JSObject();
        res.put("biometrics", can(BIOMETRIC_STRONG) ? "strong" : can(BIOMETRIC_WEAK) ? "weak" : "none");
        res.put("screenLock", km != null && km.isDeviceSecure());
        call.resolve(res);
    }

    // Reading and writing

    @PluginMethod
    public void has(PluginCall call) {
        String mode = prefs().getString(call.getString("key", "") + ".mode", null);
        JSObject res = new JSObject();
        res.put("exists", mode != null);
        res.put("locked", "bio".equals(mode) || "gate".equals(mode));
        call.resolve(res);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("key and value are required", "failed");
            return;
        }
        try {
            if (!Boolean.TRUE.equals(call.getBoolean("locked", false))) {
                Cipher cipher = Cipher.getInstance(TRANSFORM);
                cipher.init(Cipher.ENCRYPT_MODE, plainKey());
                save(key, "plain", cipher, value);
                call.resolve();
            } else if (can(strongAuthenticators())) {
                Cipher cipher = Cipher.getInstance(TRANSFORM);
                cipher.init(Cipher.ENCRYPT_MODE, newBioKey());
                prompt(call, cipher, strongAuthenticators(), (unlocked) -> {
                    save(key, "bio", unlocked, value);
                    call.resolve();
                });
            } else if (can(gateAuthenticators())) {
                prompt(call, null, gateAuthenticators(), (none) -> {
                    Cipher cipher = Cipher.getInstance(TRANSFORM);
                    cipher.init(Cipher.ENCRYPT_MODE, plainKey());
                    save(key, "gate", cipher, value);
                    call.resolve();
                });
            } else {
                call.reject("No fingerprint, face or screen lock is set up", "unavailable");
            }
        } catch (Exception e) {
            call.reject("Couldn't save it: " + e.getMessage(), "failed");
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key", "");
        SharedPreferences p = prefs();
        String mode = p.getString(key + ".mode", null);
        String data = p.getString(key + ".data", null);
        if (mode == null || data == null) {
            JSObject res = new JSObject();
            res.put("value", null);
            call.resolve(res);
            return;
        }
        String[] parts = data.split(":");
        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] sealed = Base64.decode(parts[1], Base64.NO_WRAP);
        try {
            if ("bio".equals(mode)) {
                Cipher cipher = Cipher.getInstance(TRANSFORM);
                try {
                    cipher.init(Cipher.DECRYPT_MODE, existingKey(BIO_KEY), new GCMParameterSpec(128, iv));
                } catch (KeyPermanentlyInvalidatedException e) {
                    // New fingerprints were added (or the screen lock removed): the key is gone for good.
                    forget(key);
                    deleteKey(BIO_KEY);
                    call.reject("The phone's biometrics changed", "invalidated");
                    return;
                }
                prompt(call, cipher, strongAuthenticators(), (unlocked) -> resolveValue(call, unlocked.doFinal(sealed)));
            } else if ("gate".equals(mode)) {
                prompt(call, null, gateAuthenticators(), (none) -> resolveValue(call, openPlain(iv, sealed)));
            } else {
                resolveValue(call, openPlain(iv, sealed));
            }
        } catch (Exception e) {
            // Unreadable (e.g. restored onto another phone without its keys): drop it so the app asks to sign in.
            forget(key);
            call.reject("Couldn't read it", "invalidated");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        forget(call.getString("key", ""));
        call.resolve();
    }

    // Helpers

    private void save(String key, String mode, Cipher cipher, String value) throws Exception {
        byte[] sealed = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String data = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(sealed, Base64.NO_WRAP);
        prefs().edit().putString(key + ".data", data).putString(key + ".mode", mode).apply();
    }

    private void forget(String key) {
        prefs().edit().remove(key + ".data").remove(key + ".mode").apply();
    }

    private byte[] openPlain(byte[] iv, byte[] sealed) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORM);
        cipher.init(Cipher.DECRYPT_MODE, plainKey(), new GCMParameterSpec(128, iv));
        return cipher.doFinal(sealed);
    }

    private void resolveValue(PluginCall call, byte[] plain) {
        JSObject res = new JSObject();
        res.put("value", new String(plain, StandardCharsets.UTF_8));
        call.resolve(res);
    }

    private SecretKey existingKey(String alias) throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        return (SecretKey) ks.getKey(alias, null);
    }

    private void deleteKey(String alias) {
        try {
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            if (ks.containsAlias(alias)) ks.deleteEntry(alias);
        } catch (Exception ignored) {
            // Nothing to delete.
        }
    }

    /** For values that don't need the check: still encrypted by hardware, readable by this app only. */
    private SecretKey plainKey() throws Exception {
        SecretKey key = existingKey(PLAIN_KEY);
        if (key != null) return key;
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        gen.init(
            new KeyGenParameterSpec.Builder(PLAIN_KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return gen.generateKey();
    }

    /** A fresh key that only works right after the check, and dies if new fingerprints are enrolled. */
    private SecretKey newBioKey() throws Exception {
        deleteKey(BIO_KEY);
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(BIO_KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        gen.init(spec.build());
        return gen.generateKey();
    }

    /** Shows Android's own fingerprint/face sheet. `cipher` null means a check without a key behind it. */
    private void prompt(PluginCall call, Cipher cipher, int authenticators, Done done) {
        getActivity().runOnUiThread(() -> {
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(call.getString("title", "Unlock Lanemark"))
                .setSubtitle(call.getString("subtitle", "Use your fingerprint, face or screen lock"))
                .setAllowedAuthenticators(authenticators)
                .setConfirmationRequired(false);
            // Without the screen lock as a fallback, Android needs a way out of the sheet.
            if ((authenticators & DEVICE_CREDENTIAL) == 0) info.setNegativeButtonText("Use password");

            BiometricPrompt sheet = new BiometricPrompt(getActivity(), ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    try {
                        BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                        done.run(crypto != null ? crypto.getCipher() : null);
                    } catch (Exception e) {
                        call.reject("Couldn't unlock: " + e.getMessage(), "failed");
                    }
                }

                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence message) {
                    call.reject(message.toString(), errorCode(code));
                }
            });
            if (cipher != null) sheet.authenticate(info.build(), new BiometricPrompt.CryptoObject(cipher));
            else sheet.authenticate(info.build());
        });
    }

    private static String errorCode(int code) {
        switch (code) {
            case BiometricPrompt.ERROR_USER_CANCELED:
            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
            case BiometricPrompt.ERROR_CANCELED:
                return "cancelled";
            case BiometricPrompt.ERROR_LOCKOUT:
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "lockout";
            case BiometricPrompt.ERROR_NO_BIOMETRICS:
            case BiometricPrompt.ERROR_HW_NOT_PRESENT:
            case BiometricPrompt.ERROR_HW_UNAVAILABLE:
            case BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL:
                return "unavailable";
            default:
                return "failed";
        }
    }
}
