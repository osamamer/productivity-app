package org.osama.solife.boundaries

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent

/**
 * Stops a timed-out app's audio. Sending an app home or killing its background process leaves a
 * music player's foreground service streaming, and since Android 14 an app may not kill other
 * apps' processes at all, so without Shizuku this is the only thing that silences it.
 *
 * With media control allowed ([BoundariesMediaListener]) the app's own media sessions are paused
 * and stopped, and nothing else is touched. Without it Android does not say which app is playing,
 * so the fallback pauses whatever is playing: it sends a pause media key and takes audio focus
 * for a moment, which well-behaved players treat as a permanent loss. Limitation: that fallback
 * also pauses an allowed app that happens to be playing instead.
 */
object MediaStopper {
    private const val TAG = "MediaStopper"
    private const val FOCUS_HOLD_MS = 2_000L

    private val handler = Handler(Looper.getMainLooper())
    private var focusRequest: AudioFocusRequest? = null

    fun stop(context: Context, pkg: String) {
        if (BoundariesMediaListener.isAllowed(context)) {
            sessionsOf(context, pkg).forEach(::stopController)
        } else {
            stopWhateverIsPlaying(context)
        }
    }

    /** True when media control is allowed and one of [pkg]'s sessions is playing. */
    fun isPlaying(context: Context, pkg: String): Boolean =
        BoundariesMediaListener.isAllowed(context) &&
            sessionsOf(context, pkg).any { it.playbackState?.state.isAudible() }

    private fun Int?.isAudible() = this == PlaybackState.STATE_PLAYING ||
        this == PlaybackState.STATE_BUFFERING ||
        this == PlaybackState.STATE_FAST_FORWARDING ||
        this == PlaybackState.STATE_REWINDING

    private fun sessionsOf(context: Context, pkg: String): List<MediaController> = try {
        val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
        manager.getActiveSessions(BoundariesMediaListener.component(context)).filter { it.packageName == pkg }
    } catch (e: SecurityException) {
        Log.w(TAG, "Media sessions unavailable", e)
        emptyList()
    }

    private fun stopController(controller: MediaController) {
        try {
            controller.transportControls.pause()
            controller.transportControls.stop()
        } catch (e: Exception) {
            Log.w(TAG, "Could not stop ${controller.packageName}", e)
        }
    }

    private fun stopWhateverIsPlaying(context: Context) {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (!audio.isMusicActive) return
        sendPauseKey(audio)
        takeFocusBriefly(audio)
    }

    private fun sendPauseKey(audio: AudioManager) {
        val time = SystemClock.uptimeMillis()
        audio.dispatchMediaKeyEvent(KeyEvent(time, time, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE, 0))
        audio.dispatchMediaKeyEvent(KeyEvent(time, time, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE, 0))
    }

    private fun takeFocusBriefly(audio: AudioManager) {
        focusRequest?.let(audio::abandonAudioFocusRequest)
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            .setOnAudioFocusChangeListener {}
            .build()
        focusRequest = request
        audio.requestAudioFocus(request)
        handler.postDelayed({
            audio.abandonAudioFocusRequest(request)
            if (focusRequest === request) focusRequest = null
        }, FOCUS_HOLD_MS)
    }
}
