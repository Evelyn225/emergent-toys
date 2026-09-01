function startDesktop() {
  document.getElementById('desktop').style.display = 'block';
  document.getElementById('taskbar').style.display = 'flex';
  const savedWp = getInitialWallpaperPath();
  if (savedWp) applyWallpaper(savedWp, { deferMissing: !isSystemWallpaperPath(savedWp) });
  applySettings();
  applyDaemonVisualState();
  setupIcons();
  wmInstallTaskbarMenu();
  initSystemAudio();
  // Silent unless the user already clicked or typed - most often to skip the
  // BIOS screen, which is exactly when a startup jingle belongs. On a cold load
  // that runs the boot text to the end, no gesture has happened and the browser
  // will not let audio start, so this is a no-op rather than a chime that fires
  // late. The ambience below has no such problem: it records the request and
  // begins at the first click.
  playSound('boot');
  startSoundLoop('ambience');
  // After setupIcons, so it opens over a desktop that is already drawn rather
  // than appearing first and having the icons pop in behind it. No-op on every
  // boot after the first.
  maybeShowFirstRunWelcome();
  armIdleSleep();
}
