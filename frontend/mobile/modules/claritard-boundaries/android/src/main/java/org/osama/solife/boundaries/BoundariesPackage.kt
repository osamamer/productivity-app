package org.osama.solife.boundaries

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/** Initializes the optional privileged bridge whenever the app process starts. */
class BoundariesPackage : Package {
    override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
        listOf(object : ApplicationLifecycleListener {
            override fun onCreate(application: Application) {
                ShizukuBridge.initialize(application)
            }
        })
}
