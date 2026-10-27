pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    // jitpack hosts RootEncoder (live broadcasting from the camera).
    repositories { google(); mavenCentral(); maven("https://jitpack.io") }
}
rootProject.name = "shekinah"
include(":app")
