# VaultCalcApp ProGuard/R8 Rules

# ===== REACT NATIVE NATIVE MODULES =====

# Keep all native module base classes and their methods
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }

# Keep ReactPackage implementations (resolved via reflection)
-keep class * extends com.facebook.react.ReactPackage { *; }

# Keep @ReactMethod annotated methods (called via reflection from JS bridge)
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Keep constructors that take ReactApplicationContext (required for module instantiation)
-keepclasseswithmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    public <init>(com.facebook.react.bridge.ReactApplicationContext);
}

# ===== VAULTCALCAPP MODULES =====

-keep class com.vaultcalcapp.modules.** { *; }
-keep class com.vaultcalcapp.widget.** { *; }
-keep class com.vaultcalcapp.MainActivity { *; }
-keep class com.vaultcalcapp.MainApplication { *; }

# ===== THIRD-PARTY LIBRARIES =====

# Google Tink (cryptography)
-keep class com.google.crypto.tink.** { *; }

# Bouncy Castle (Argon2id)
-keep class org.bouncycastle.** { *; }

# Google Play Billing
-keep class com.android.billingclient.** { *; }

# AndroidX Biometric
-keep class androidx.biometric.** { *; }

# CameraX
-keep class androidx.camera.** { *; }

# ===== HERMES ENGINE =====

-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ===== GUAVA (suppress unused JDK8 reference warnings) =====

-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn sun.misc.Unsafe

# ===== GOOGLE PLAY SERVICES =====

-keep class com.google.android.gms.** { *; }

# ===== EXPO MODULES =====

-keep class expo.modules.** { *; }

# ===== DEBUGGING =====

# Keep line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
