(() => {
    const path = require('path')
        const fs = require('fs')
    const ConfigManager = require('./assets/js/configmanager')

    const TRACKS = {
        landing: {
            src: 'assets/music/main-menu.ogg',
            loopStart: 9.5
        },
        login: {
            src: 'assets/music/menu-secondary.ogg',
            loopStart: 5.5
        },
        loginOptions: {
            src: 'assets/music/menu-secondary.ogg',
            loopStart: 5.5
        },
        settings: {
            src: 'assets/music/menu-secondary.ogg',
            loopStart: 5.5
        },
        welcome: {
            src: 'assets/music/menu-secondary.ogg',
            loopStart: 5.5
        },
        waiting: {
            src: 'assets/music/menu-secondary.ogg',
            loopStart: 5.5
        }
    }

    const APP_ROOT = path.resolve(__dirname)

    let audio = null
    let currentTrackKey = null
    let currentTrackSrc = null
    let currentLoopStart = 0
    let lastNonZeroVolume = Math.max(0.05, Number(ConfigManager.getMusicVolume() || 0.2))
    let hoverHideTimeout = null
    let sliderDragActive = false
    let currentObjectUrl = null
    let musicPausedForGame = false

function getMimeTypeForAudio(filePath){
    const ext = path.extname(filePath).toLowerCase()

    switch(ext){
        case '.mp3':
            return 'audio/mpeg'
        case '.ogg':
            return 'audio/ogg'
        case '.wav':
            return 'audio/wav'
        case '.m4a':
            return 'audio/mp4'
        default:
            return 'application/octet-stream'
    }
}

function resolveTrackSource(trackSrc){
    const normalizedRelative = String(trackSrc || '').replace(/^[\\/]+/, '')
    const absolutePath = path.resolve(APP_ROOT, normalizedRelative)

    if(!fs.existsSync(absolutePath)){
        console.warn('[Launcher Music] File not found:', absolutePath)
        return null
    }

    try {
        const fileBuffer = fs.readFileSync(absolutePath)
        const mimeType = getMimeTypeForAudio(absolutePath)
        const blob = new Blob([fileBuffer], { type: mimeType })
        return window.URL.createObjectURL(blob)
    } catch (err) {
        console.warn('[Launcher Music] Failed to create object URL for:', absolutePath, err)
        return null
    }
}


    function createObjectUrlFromAsset(relativePath){
        const resolvedSrc = resolveTrackSource(relativePath)
        if(!resolvedSrc){
            return null
        }
        return resolvedSrc
    }

    function playIntroSoundOnce(){
        if(window.__launcherIntroSoundPlayed){
            return
        }
        window.__launcherIntroSoundPlayed = true

        const introSrc = createObjectUrlFromAsset('assets/sfx/logo.wav')
        if(!introSrc){
            return
        }

        const introAudio = document.createElement('audio')
        introAudio.preload = 'auto'
        introAudio.volume = ConfigManager.getMusicMuted() ? 0 : Number(ConfigManager.getMusicVolume() || 0.2)
        introAudio.src = introSrc

        const cleanup = () => {
            try {
                window.URL.revokeObjectURL(introSrc)
            } catch (e) {}
        }

        introAudio.addEventListener('ended', cleanup, { once: true })
        introAudio.addEventListener('error', cleanup, { once: true })

        introAudio.play().catch((e) => {
            console.warn('Launcher intro sound playback was blocked.', e)
            cleanup()
        })
    }

    function ensureAudio(){
    if(audio != null) return audio

    audio = document.createElement('audio')
    audio.loop = false
    audio.preload = 'auto'
    audio.autoplay = false
    audio.crossOrigin = 'anonymous'

    audio.addEventListener('ended', async () => {
        if(!currentTrackSrc) return

        try {
            audio.currentTime = Math.max(0, Number(currentLoopStart) || 0)
            await audio.play()
        } catch (e) {
            console.warn('Launcher music loop playback was blocked.', e)
        }
    })

    audio.addEventListener('error', () => {
        console.warn('[Launcher Music] Audio error for source:', currentTrackSrc, audio.error)
    })

    applyVolumeState()
    return audio
}

    function applyVolumeState(){
        const a = ensureAudio()
        const muted = ConfigManager.getMusicMuted()
        const volume = Number(ConfigManager.getMusicVolume() || 0)
        a.muted = muted
        a.volume = muted ? 0 : volume

        const muteButtons = [
            document.getElementById('launcherAudioButton'),
            document.getElementById('settingsAudioButton')
        ]
        const sliders = [
            document.getElementById('launcherVolumeSlider'),
            document.getElementById('settingsVolumeSlider')
        ]

        for(const muteBtn of muteButtons){
            if(!muteBtn) continue
            if(muted){
                muteBtn.setAttribute('muted', '')
            } else {
                muteBtn.removeAttribute('muted')
            }
        }

        for(const slider of sliders){
            if(slider && document.activeElement !== slider){
                slider.value = Math.round(volume * 100)
            }
        }
    }

    async function playTrack(trackKey){
    const track = TRACKS[trackKey]
    if(!track || !track.src) return

    const resolvedSrc = resolveTrackSource(track.src)
    if(!resolvedSrc) return

    const a = ensureAudio()
    const loopStart = Math.max(0, Number(track.loopStart) || 0)

    if(currentTrackKey === trackKey && currentTrackSrc === resolvedSrc) {
        currentLoopStart = loopStart
        applyVolumeState()
        return
    }

    currentTrackKey = trackKey
    currentLoopStart = loopStart

    a.pause()

    if(currentObjectUrl){
        try {
            window.URL.revokeObjectURL(currentObjectUrl)
        } catch (e) {}
        currentObjectUrl = null
    }

    a.removeAttribute('src')
    a.load()

    currentTrackSrc = resolvedSrc
    currentObjectUrl = resolvedSrc

    a.src = resolvedSrc
    applyVolumeState()

    try {
        await a.play()
    } catch (e) {
        console.warn('Launcher music playback was blocked.', e, 'Resolved source:', resolvedSrc)
    }
}

    function syncLauncherMusicForView(view){
        if(TRACKS[view]){
            playTrack(view)
        }
    }

    function toggleLauncherMute(){
        const currentlyMuted = ConfigManager.getMusicMuted()
        const currentVolume = Number(ConfigManager.getMusicVolume() || 0)

        if(currentlyMuted){
            ConfigManager.setMusicMuted(false)
            if(currentVolume <= 0){
                ConfigManager.setMusicVolume(lastNonZeroVolume)
            }
        } else {
            if(currentVolume > 0){
                lastNonZeroVolume = currentVolume
            }
            ConfigManager.setMusicMuted(true)
        }

        ConfigManager.save()
        applyVolumeState()
    }

    function openAudioPopover(control){
        if(hoverHideTimeout){
            clearTimeout(hoverHideTimeout)
            hoverHideTimeout = null
        }
        if(control){
            control.setAttribute('open', '')
        }
    }

    function closeAudioPopover(control, delay = 120){
        if(!control || sliderDragActive) return
        if(hoverHideTimeout){
            clearTimeout(hoverHideTimeout)
        }
        hoverHideTimeout = setTimeout(() => {
            if(!sliderDragActive){
                control.removeAttribute('open')
            }
        }, delay)
    }

    function initLauncherAudioControls(){
        const control = document.getElementById('launcherAudioControl')
        const muteBtn = document.getElementById('launcherAudioButton')
        const slider = document.getElementById('launcherVolumeSlider')

        if(!control || !muteBtn || !slider) return

        const keepOpen = () => openAudioPopover(control)
        const maybeClose = () => closeAudioPopover(control)

        control.addEventListener('mouseenter', keepOpen)
        control.addEventListener('mouseleave', maybeClose)
        muteBtn.addEventListener('focus', keepOpen)
        muteBtn.addEventListener('blur', maybeClose)
        slider.addEventListener('focus', keepOpen)
        slider.addEventListener('blur', maybeClose)
        slider.addEventListener('mouseenter', keepOpen)
        slider.addEventListener('mouseleave', maybeClose)

        slider.addEventListener('pointerdown', () => {
            sliderDragActive = true
            openAudioPopover(control)
        })

        window.addEventListener('pointerup', () => {
            if(sliderDragActive){
                sliderDragActive = false
                closeAudioPopover(control, 180)
            }
        })

        muteBtn.addEventListener('click', (e) => {
            e.preventDefault()
            toggleLauncherMute()
            openAudioPopover(control)
        })

        bindVolumeSlider(slider, () => openAudioPopover(control))

        applyVolumeState()
    }


    function bindVolumeSlider(slider, onInteract){
        if(!slider) return

        slider.addEventListener('input', (e) => {
            const volume = Number(e.target.value) / 100
            if(volume > 0){
                lastNonZeroVolume = volume
            }
            ConfigManager.setMusicVolume(volume)
            ConfigManager.setMusicMuted(volume <= 0)
            ConfigManager.save()
            applyVolumeState()
            if(typeof onInteract === 'function'){
                onInteract()
            }
        })
    }

    function initSettingsAudioControls(){
        const muteBtn = document.getElementById('settingsAudioButton')
        const slider = document.getElementById('settingsVolumeSlider')

        if(!muteBtn || !slider) return

        muteBtn.addEventListener('click', (e) => {
            e.preventDefault()
            toggleLauncherMute()
        })

        bindVolumeSlider(slider)
        applyVolumeState()
    }

    function pauseLauncherMusicForGame(){
    const a = ensureAudio()
    musicPausedForGame = !!(a && !a.paused)

    try {
        a.pause()
    } catch (e) {
        console.warn('Failed to pause launcher music for game.', e)
    }
}

async function resumeLauncherMusicAfterGame(){
    if(!musicPausedForGame) return
    musicPausedForGame = false

    if(ConfigManager.getMusicMuted()) return

    const a = ensureAudio()
    if(!currentTrackSrc) return

    try {
        await a.play()
    } catch (e) {
        console.warn('Failed to resume launcher music after game.', e)
    }
}

    window.syncLauncherMusicForView = syncLauncherMusicForView
    window.pauseLauncherMusicForGame = pauseLauncherMusicForGame
    window.resumeLauncherMusicAfterGame = resumeLauncherMusicAfterGame
    window.syncLauncherMusicForView = syncLauncherMusicForView

    document.addEventListener('readystatechange', function(){
        if(document.readyState === 'complete'){
            initLauncherAudioControls()
            initSettingsAudioControls()
            playIntroSoundOnce()
            if(typeof getCurrentView === 'function' && getCurrentView()){
                syncLauncherMusicForView(getCurrentView())
            }
        }
    })
})()
