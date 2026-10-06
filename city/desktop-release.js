// Stable desktop releases share the repo with other toys; only accept our tagged Windows installers.
function desktopVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  const parts = version.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function newerDesktopVersion(left, right) {
  const a = desktopVersion(left), b = desktopVersion(right);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function desktopReleaseUpdate(releases, installed) {
  if (!Array.isArray(releases) || !desktopVersion(installed)) throw new Error('Invalid release data');
  let update = null;
  for (const release of releases) {
    if (!release || release.draft || release.prerelease || typeof release.tag_name !== 'string' || !release.tag_name.startsWith('ascii-city-v')) continue;
    const version = release.tag_name.slice('ascii-city-v'.length);
    if (!newerDesktopVersion(version, update ? update.version : installed)) continue;
    const url = `https://github.com/Evelyn225/emergent-toys/releases/download/ascii-city-v${version}/Glyphport-Setup.exe`;
    if (Array.isArray(release.assets) && release.assets.some(asset => asset && asset.name === 'Glyphport-Setup.exe' && asset.browser_download_url === url)) update = { version, url };
  }
  return update;
}
