plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.shekinahsons.globalapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.shekinahsons.globalapp"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "2.0.0"
    }
    buildTypes {
        // Debug talks to the local backend through `adb reverse tcp:3000 tcp:3000`.
        debug { buildConfigField("String", "API_BASE", "\"http://127.0.0.1:3000\"") }
        release {
            buildConfigField("String", "API_BASE", "\"https://shekinah-sons-backend.onrender.com\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true; buildConfig = true }
    lint { disable += "UnsafeOptInUsageError" }
}

kotlin {
    jvmToolchain(17)
    compilerOptions {
        optIn.add("androidx.media3.common.util.UnstableApi")
        optIn.add("androidx.compose.foundation.ExperimentalFoundationApi")
        optIn.add("androidx.compose.material3.ExperimentalMaterial3Api")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.icons)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.database)
    implementation(libs.media3.hls)
    implementation(libs.media3.okhttp)
    implementation(libs.media3.ui)
    implementation(libs.media3.session)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.coil.okhttp)
    implementation(libs.serialization.json)
}

configurations.configureEach {
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk7")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk8")
}
