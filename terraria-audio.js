(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function holdAndSet(param, value, now) {
    try {
      param.cancelAndHoldAtTime(now);
    } catch (error) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
    param.setValueAtTime(value, now);
  }

  class TerrariaAudioManager {
    constructor(options = {}) {
      this.storageKey = options.storageKey || 'terraria_v2_audio_settings';
      this.fadeInMs = options.fadeInMs ?? 2000;
      this.fadeOutMs = options.fadeOutMs ?? 2000;
      this.initialGameplayDelayMs = options.initialGameplayDelayMs ?? 14000;
      this.gameplayPauseMinMs = Math.max(options.gameplayPauseMinMs ?? 65000, 60001);
      this.gameplayPauseMaxMs = Math.max(options.gameplayPauseMaxMs ?? 98000, this.gameplayPauseMinMs);
      this.defaultMasterVolume = clamp(options.defaultMasterVolume ?? 0.4, 0, 1);
      this.defaultMusicVolume = clamp(options.defaultMusicVolume ?? 0.65, 0, 1);

      const menuTrack = options.menuTrack || {};
      this.menuTrack = {
        id: menuTrack.id || 'menu-intro',
        kind: 'menu',
        src: menuTrack.src,
        loop: true,
        baseVolume: clamp(menuTrack.baseVolume ?? 0.34, 0, 1),
        gameplayBaseVolume: clamp(menuTrack.gameplayBaseVolume ?? 0.7, 0, 1),
        filterFrequency: menuTrack.filterFrequency ?? 980,
        filterQ: menuTrack.filterQ ?? 0.32,
        gameplayFilterFrequency: menuTrack.gameplayFilterFrequency ?? 22000,
        gameplayFilterQ: menuTrack.gameplayFilterQ ?? 0.0001,
      };

      this.gameplayTracks = (options.gameplayTracks || []).map((track, index) => ({
        id: track.id || `game-${index}`,
        kind: 'gameplay',
        src: track.src,
        loop: false,
        baseVolume: clamp(track.baseVolume ?? 1, 0, 1),
        filterFrequency: track.filterFrequency ?? 22000,
        filterQ: track.filterQ ?? 0.0001,
      }));

      this.masterVolume = this.defaultMasterVolume;
      this.musicVolume = this.defaultMusicVolume;
      this.mode = null;
      this.state = 'mainmenu';
      this.currentTrack = null;
      this.lastGameplayTrackId = null;
      this.nextGameplayTimer = null;
      this.transitionTimer = null;
      this.fadeOutTriggered = false;
      this.unlocked = false;

      this.ctx = null;
      this.sourceNode = null;
      this.filterNode = null;
      this.trackGainNode = null;
      this.musicGainNode = null;
      this.masterGainNode = null;

      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.playsInline = true;
      this.audio.loop = false;

      this.handleEnded = this.handleEnded.bind(this);
      this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
      this.handleUnlock = this.handleUnlock.bind(this);

      this.audio.addEventListener('ended', this.handleEnded);
      this.audio.addEventListener('timeupdate', this.handleTimeUpdate);

      this.loadSettings();
      this.bindUnlockEvents();
    }

    bindUnlockEvents() {
      window.addEventListener('pointerdown', this.handleUnlock);
      window.addEventListener('keydown', this.handleUnlock);
      window.addEventListener('touchstart', this.handleUnlock);
    }

    handleUnlock() {
      this.unlock();
    }

    unlock() {
      this.unlocked = true;
      this.ensureGraph();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.updateBusVolumes(true);
      if (this.currentTrack) {
        this.applyTrackTone(this.currentTrack);
        this.playCurrentTrack();
      } else {
        this.syncState(this.state);
      }
    }

    ensureGraph() {
      if (this.ctx) return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;

      this.ctx = new AudioContextCtor();
      this.sourceNode = this.ctx.createMediaElementSource(this.audio);
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 22000;
      this.filterNode.Q.value = 0.0001;

      this.trackGainNode = this.ctx.createGain();
      this.trackGainNode.gain.value = 0;
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.gain.value = this.musicVolume;
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.value = this.masterVolume;

      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.trackGainNode);
      this.trackGainNode.connect(this.musicGainNode);
      this.musicGainNode.connect(this.masterGainNode);
      this.masterGainNode.connect(this.ctx.destination);
    }

    loadSettings() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.masterVolume === 'number') {
          this.masterVolume = clamp(data.masterVolume, 0, 1);
        }
        if (typeof data.musicVolume === 'number') {
          this.musicVolume = clamp(data.musicVolume, 0, 1);
        }
      } catch (error) {
        console.warn('[terraria-audio] failed to load settings', error);
      }
    }

    saveSettings() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          masterVolume: this.masterVolume,
          musicVolume: this.musicVolume,
        }));
      } catch (error) {
        console.warn('[terraria-audio] failed to save settings', error);
      }
    }

    getMasterVolume() {
      return this.masterVolume;
    }

    getMusicVolume() {
      return this.musicVolume;
    }

    setMasterVolume(value) {
      this.masterVolume = clamp(value, 0, 1);
      this.saveSettings();
      this.updateBusVolumes();
    }

    setMusicVolume(value) {
      this.musicVolume = clamp(value, 0, 1);
      this.saveSettings();
      this.updateBusVolumes();
    }

    updateBusVolumes(immediate = false) {
      if (!this.ctx || !this.masterGainNode || !this.musicGainNode) return;
      const now = this.ctx.currentTime;

      if (immediate) {
        holdAndSet(this.masterGainNode.gain, this.masterVolume, now);
        holdAndSet(this.musicGainNode.gain, this.musicVolume, now);
        return;
      }

      holdAndSet(this.masterGainNode.gain, this.masterGainNode.gain.value, now);
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, now, 0.08);
      holdAndSet(this.musicGainNode.gain, this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.setTargetAtTime(this.musicVolume, now, 0.08);
    }

    syncState(state) {
      this.state = state;
      if (state === 'mainmenu') {
        this.enterMenuMode();
        return;
      }
      if (state === 'playing' || state === 'paused') {
        this.enterGameplayMode();
      }
    }

    enterMenuMode() {
      this.mode = 'menu';
      this.clearGameplayTimer();
      if (this.currentTrack?.id === this.menuTrack.id) {
        this.currentTrack = { ...this.menuTrack };
        this.audio.loop = true;
        this.applyTrackTone(this.currentTrack);
        this.playCurrentTrack();
        return;
      }
      this.startTrack(this.menuTrack);
    }

    enterGameplayMode() {
      this.mode = 'gameplay';
      if (this.currentTrack?.kind === 'gameplay') {
        this.applyTrackTone(this.currentTrack);
        this.playCurrentTrack();
        return;
      }
      if (this.currentTrack?.id === this.menuTrack.id) {
        this.promoteMenuTrackToGameplay();
        return;
      }
      if (this.nextGameplayTimer) return;
      if (this.currentTrack) {
        this.fadeOutCurrentTrack(() => this.scheduleNextGameplayTrack(this.initialGameplayDelayMs));
      } else {
        this.scheduleNextGameplayTrack(this.initialGameplayDelayMs);
      }
    }

    clearGameplayTimer() {
      if (!this.nextGameplayTimer) return;
      clearTimeout(this.nextGameplayTimer);
      this.nextGameplayTimer = null;
    }

    clearTransitionTimer() {
      if (!this.transitionTimer) return;
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }

    randomGameplayPauseMs() {
      const range = this.gameplayPauseMaxMs - this.gameplayPauseMinMs;
      return this.gameplayPauseMinMs + Math.round(Math.random() * range);
    }

    scheduleNextGameplayTrack(delayMs = this.randomGameplayPauseMs()) {
      this.clearGameplayTimer();
      if (this.mode !== 'gameplay' || this.gameplayTracks.length === 0) return;
      this.nextGameplayTimer = setTimeout(() => {
        this.nextGameplayTimer = null;
        if (this.mode !== 'gameplay') return;
        const track = this.pickGameplayTrack();
        if (track) this.startTrack(track);
      }, Math.max(0, delayMs));
    }

    pickGameplayTrack() {
      if (this.gameplayTracks.length === 0) return null;
      const choices = this.gameplayTracks.filter(track => track.id !== this.lastGameplayTrackId);
      const pool = choices.length > 0 ? choices : this.gameplayTracks;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    promoteMenuTrackToGameplay() {
      if (!this.currentTrack || this.currentTrack.id !== this.menuTrack.id) return;
      this.clearGameplayTimer();
      this.currentTrack = {
        id: this.menuTrack.id,
        kind: 'gameplay',
        src: this.menuTrack.src,
        loop: false,
        baseVolume: this.menuTrack.gameplayBaseVolume,
        filterFrequency: this.menuTrack.gameplayFilterFrequency,
        filterQ: this.menuTrack.gameplayFilterQ,
      };
      this.audio.loop = false;
      this.fadeOutTriggered = false;
      this.applyTrackTone(this.currentTrack);
      this.fadeTrackTo(this.currentTrack.baseVolume, 1400);
      this.playCurrentTrack();
    }

    startTrack(track) {
      if (!track?.src) return;
      this.clearGameplayTimer();
      this.clearTransitionTimer();

      const begin = () => {
        this.currentTrack = track;
        this.fadeOutTriggered = false;
        this.audio.pause();
        this.audio.loop = !!track.loop;
        this.audio.src = track.src;
        this.audio.currentTime = 0;
        this.audio.load();
        this.applyTrackTone(track);

        if (this.trackGainNode && this.ctx) {
          const now = this.ctx.currentTime;
          holdAndSet(this.trackGainNode.gain, 0, now);
        }

        this.playCurrentTrack();
      };

      if (this.currentTrack) {
        this.fadeOutCurrentTrack(begin);
      } else {
        begin();
      }
    }

    playCurrentTrack() {
      if (!this.currentTrack) return;
      if (!this.unlocked) return;
      this.ensureGraph();
      if (!this.ctx || this.ctx.state === 'closed') return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.applyTrackTone(this.currentTrack);
      this.audio.play().catch(() => {});
      this.fadeTrackTo(this.currentTrack.baseVolume, this.fadeInMs);
    }

    applyTrackTone(track) {
      if (!this.ctx || !this.filterNode || !track) return;
      const now = this.ctx.currentTime;
      holdAndSet(this.filterNode.frequency, this.filterNode.frequency.value, now);
      this.filterNode.frequency.setTargetAtTime(track.filterFrequency ?? 22000, now, 0.08);
      holdAndSet(this.filterNode.Q, this.filterNode.Q.value, now);
      this.filterNode.Q.setTargetAtTime(track.filterQ ?? 0.0001, now, 0.08);
    }

    fadeTrackTo(targetVolume, durationMs) {
      if (!this.ctx || !this.trackGainNode) return;
      const now = this.ctx.currentTime;
      holdAndSet(this.trackGainNode.gain, this.trackGainNode.gain.value, now);
      this.trackGainNode.gain.linearRampToValueAtTime(clamp(targetVolume, 0, 1), now + durationMs / 1000);
    }

    fadeOutCurrentTrack(onDone) {
      const outgoing = this.currentTrack;
      this.clearTransitionTimer();
      if (!outgoing) {
        if (onDone) onDone();
        return;
      }

      if (this.trackGainNode && this.ctx) {
        this.fadeTrackTo(0, this.fadeOutMs);
      }

      this.transitionTimer = setTimeout(() => {
        this.transitionTimer = null;
        this.audio.pause();
        this.audio.currentTime = 0;
        if (outgoing.kind === 'gameplay') {
          this.lastGameplayTrackId = outgoing.id;
        }
        if (this.currentTrack?.id === outgoing.id) {
          this.currentTrack = null;
        }
        this.fadeOutTriggered = false;
        if (onDone) onDone();
      }, this.fadeOutMs + 80);
    }

    handleTimeUpdate() {
      if (!this.currentTrack || this.currentTrack.kind !== 'gameplay' || this.fadeOutTriggered) return;
      if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
      const remaining = this.audio.duration - this.audio.currentTime;
      if (remaining > this.fadeOutMs / 1000 + 0.12) return;

      this.fadeOutTriggered = true;
      const outgoingId = this.currentTrack.id;
      this.fadeOutCurrentTrack(() => {
        if (this.mode !== 'gameplay' || this.lastGameplayTrackId !== outgoingId) return;
        this.scheduleNextGameplayTrack();
      });
    }

    handleEnded() {
      if (!this.currentTrack) return;
      if (this.fadeOutTriggered) return;
      const finished = this.currentTrack;
      this.audio.pause();
      this.audio.currentTime = 0;
      this.currentTrack = null;
      if (finished.kind === 'gameplay') {
        this.lastGameplayTrackId = finished.id;
      }
      if (this.mode === 'gameplay' && finished.kind === 'gameplay') {
        this.scheduleNextGameplayTrack();
      } else if (this.mode === 'menu' && finished.kind === 'menu') {
        this.startTrack(this.menuTrack);
      }
    }
  }

  window.TerrariaAudioManager = TerrariaAudioManager;
})();
