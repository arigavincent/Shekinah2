import java.net.URI
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Optional settings export from Admin > Settings > Production.
val releaseSettingsApi = providers.gradleProperty("releaseSettingsFile").map { path ->
    Properties().apply { file(path).inputStream().use { load(it) } }.getProperty("releaseApiBase", "")
}
val productionApiBase = providers.gradleProperty("releaseApiBase").orElse(releaseSettingsApi).orElse(System.getenv("SHEKINAH_API_BASE") ?: "")

android {
    namespace = "com.shekinahsons.globalapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.shekinahsons.globalapp"
        minSdk = 26
        targetSdk = 36
        testInstrumentationRunner = "com.shekinahsons.globalapp.live.DirectLiveAcceptance"
        versionCode = providers.gradleProperty("versionCode").orElse("2").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("2.0.1").get()
        // Firebase: drop the google-services.json from the Firebase console into
        // app/ (it is git-ignored). Without it the app checks the announcement
        // feed itself instead of receiving pushes.
        val firebase = file("google-services.json").takeIf { it.exists() }?.readText().orEmpty()
        fun find(pattern: String) = Regex(pattern).find(firebase)?.groupValues?.get(1).orEmpty()
        fun quoted(value: String) = "\"" + value + "\""
        buildConfigField("String", "FIREBASE_APP_ID", quoted(find("\"mobilesdk_app_id\"\\s*:\\s*\"([^\"]+)\"")))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(find("\"current_key\"\\s*:\\s*\"([^\"]+)\"")))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(find("\"project_id\"\\s*:\\s*\"([^\"]+)\"")))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(find("\"project_number\"\\s*:\\s*\"([^\"]+)\"")))
    }
    signingConfigs {
        if(System.getenv("SHEKINAH_KEYSTORE")!=null) create("production") {
            storeFile=file(System.getenv("SHEKINAH_KEYSTORE"))
            storePassword=System.getenv("SHEKINAH_STORE_PASSWORD")
            keyAlias=System.getenv("SHEKINAH_KEY_ALIAS")
            keyPassword=System.getenv("SHEKINAH_KEY_PASSWORD")
        }
    }
    buildTypes {
        // Debug talks to the local backend through `adb reverse tcp:3000 tcp:3000`.
        debug { buildConfigField("String", "API_BASE", "\"http://127.0.0.1:3000\"") }
        release {
            buildConfigField("String", "API_BASE", "\"${productionApiBase.get().trimEnd('/')}\"")
            signingConfig=signingConfigs.findByName("production")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    buildTypes.create("qa") {
        initWith(buildTypes.getByName("release"))
        signingConfig=signingConfigs.getByName("debug")
        buildConfigField("String","API_BASE","\"${providers.gradleProperty("qaApiBase").orElse("http://127.0.0.1:3000").get().trimEnd('/')}\"")
        matchingFallbacks += "release"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true; buildConfig = true }
    // The bundled Bible database is copied out once; keep it uncompressed so that is fast.
    androidResources { noCompress += "db" }
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
    implementation("com.google.zxing:core:3.5.3")
    // Camera for scanning members' QR codes at the gate.
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    implementation("com.google.firebase:firebase-messaging:25.1.3")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("com.github.pedroSG94.RootEncoder:library:2.8.1")
}

configurations.configureEach {
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk7")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk8")
}

val validateProductionRelease by tasks.registering {
    doLast {
        val base=productionApiBase.get()
        require(base.startsWith("https://") && URI(base).host?.let { it!="example.com" && it!="localhost" }==true) { "Set releaseApiBase or SHEKINAH_API_BASE to the production HTTPS API." }
        listOf("SHEKINAH_KEYSTORE","SHEKINAH_STORE_PASSWORD","SHEKINAH_KEY_ALIAS","SHEKINAH_KEY_PASSWORD").forEach { require(!System.getenv(it).isNullOrBlank()) { "Set $it for the ministry-owned production signing key." } }
        require(file(System.getenv("SHEKINAH_KEYSTORE")).isFile) { "Production keystore file was not found." }
    }
}
tasks.matching { it.name=="preReleaseBuild" }.configureEach { dependsOn(validateProductionRelease) }
