package com.vaultcalcapp.modules.applock

/**
 * Static bridge so LockScreenActivity can request the accessibility
 * service's RecentsCoverManager to hide the overlay.
 */
object RecentsCoverBridge {
    private var manager: RecentsCoverManager? = null

    fun register(mgr: RecentsCoverManager) { manager = mgr }
    fun unregister() { manager = null }
    fun hideCover() { manager?.hideCover() }
}
