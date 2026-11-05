plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.austwise.bubble"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.austwise.bubble"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// No AndroidX / Compose needed: the whole UI is a plain Activity plus one
// WindowManager overlay view, which keeps the APK under a few hundred KB.
