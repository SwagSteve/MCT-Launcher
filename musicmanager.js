(() => {
    const ConfigManager = require('../configmanager')
    const path = require('path')
    const { pathToFileURL } = require('url')

    const TRACKS = {
        landing: {
            src: 'assets/music/main-menu.mp3',
            loopStart: 9.5
        },
        login: {
            src: 'assets/music/menu-secondary.mp3',
            loopStart: 5.5
        },
        loginOptions: {
            src: 'assets/music/menu-secondary.mp3',
            loopStart: 5.5
        },
        settings: {
            src: 'assets/music/menu-secondary.mp3',
            loopStart: 5.5
        },
        welcome: {
            src: 'assets/music/menu-secondary.mp3',
            loopStart: 5.5
        },
        waiting: {
            src: 'assets/music/menu-secondary.mp3',
            loopStart: 5.5
        }
    }

    let audio = null
    let currentTrackKey = null
    let currentTrackSrc = null
    let currentLoopStart = 0
    let hidePopoverTimeout = null
    let lastNonZeroVolume = Math.max(0.05, Number(ConfigManager.getMusicVolume() || 0.5))

    function resolveTrackURL(src){
        return pathToFileURL(path.join(__dirname, '..', '..', src)).href
    }

    function ensureAudio(){
        if(audio != null) return audio

        audio = new Audio()
        audio.loop = false
        audio.preload = 'auto'

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
            const mediaError = audio.error
            console.warn('Launcher music failed to load.', {
                src: audio.currentSrc || audio.src,
                code: mediaError ? mediaError.code : null,
                message: mediaError ? mediaError.message : null
            })
        })

        applyVolumeState()
        return audio
    }

    function applyVolumeState(){
        const a = ensureAudio()
        const muted = ConfigManager.getMusicMuted()
        const volume = Math.max(0, Math.min(1, Number(ConfigManager.getMusicVolume() || 0)))
        a.muted = muted
        a.volume = muted ? 0 : volume

        const muteBtn = document.getElementById('launcherAudioButton')
        const slider = document.getElementById('launcherVolumeSlider')

        if(muteBtn){
            if(muted){
                muteBtn.setAttribute('muted', '')
            } else {
                muteBtn.removeAttribute('muted')
            }
        }

        if(slider && document.activeElement !== slider){
            slider.value = Math.round(volume * 100)
        }
    }

    async function playTrack(trackKey){
        const track = TRACKS[trackKey]
        if(!track || !track.src) return

        const a = ensureAudio()
        const src = resolveTrackURL(track.src)
        const loopStart = Math.max(0, Number(track.loopStart) || 0)

        if(currentTrackKey === trackKey && currentTrackSrc === src) {
            currentLoopStart = loopStart
            applyVolumeState()
            return
        }

        currentTrackKey = trackKey
        currentTrackSrc = src
        currentLoopStart = loopStart

        a.pause()
        a.src = src
        a.load()
        a.currentTime = 0
        applyVolumeState()

        try {
            await a.play()
        } catch (e) {
            console.warn('Launcher music playback was blocked.', e)
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

    function showLauncherAudioPopover(){
        const control = document.getElementById('launcherAudioControl')
        if(!control) return
        if(hidePopoverTimeout){
            clearTimeout(hidePopoverTimeout)
            hidePopoverTimeout = null
        }
        control.setAttribute('open', '')
    }

    function hideLauncherAudioPopover(){
        const control = document.getElementById('launcherAudioControl')
        if(!control) return
        if(hidePopoverTimeout){
            clearTimeout(hidePopoverTimeout)
        }
        hidePopoverTimeout = setTimeout(() => {
            control.removeAttribute('open')
            hidePopoverTimeout = null
        }, 180)
    }

    function initLauncherAudioControls(){
        const control = document.getElementById('launcherAudioControl')
        const muteBtn = document.getElementById('launcherAudioButton')
        const slider = document.getElementById('launcherVolumeSlider')
        const popover = document.getElementById('launcherAudioPopover')

        if(!control || !muteBtn || !slider || !popover) return

        ;[control, muteBtn, slider, popover].forEach((el) => {
            el.addEventListener('mouseenter', showLauncherAudioPopover)
            el.addEventListener('mouseleave', hideLauncherAudioPopover)
        })

        muteBtn.addEventListener('focus', showLauncherAudioPopover)
        slider.addEventListener('focus', showLauncherAudioPopover)
        muteBtn.addEventListener('blur', hideLauncherAudioPopover)
        slider.addEventListener('blur', hideLauncherAudioPopover)

        muteBtn.addEventListener('click', (e) => {
            e.preventDefault()
            toggleLauncherMute()
        })

        slider.addEventListener('input', (e) => {
            const volume = Number(e.target.value) / 100
            if(volume > 0){
                lastNonZeroVolume = volume
            }
            ConfigManager.setMusicVolume(volume)
            ConfigManager.setMusicMuted(volume <= 0)
            ConfigManager.save()
            applyVolumeState()
            showLauncherAudioPopover()
        })

        applyVolumeState()
    }

    window.syncLauncherMusicForView = syncLauncherMusicForView

    document.addEventListener('readystatechange', function(){
        if(document.readyState === 'complete'){
            initLauncherAudioControls()
            if(typeof getCurrentView === 'function' && getCurrentView()){
                syncLauncherMusicForView(getCurrentView())
            }
        }
    })
})()
