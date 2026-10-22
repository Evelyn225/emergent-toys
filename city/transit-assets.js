// One source of truth for recordings, prepared upload assets and exact in-game labels.
// Originals stay in audio/ascii city/. Null files deliberately skip the entire utterance.
const TRANSIT_ASSETS = {
  phrases: {
    next: { source: 'The next stop is.mp3', file: 'transit/next.wav' },
    arrival: { source: 'This is.mp3', file: 'transit/arrival.wav' },
    east: { source: 'This is an eastbound train.mp3', file: 'transit/east.wav' },
    west: { source: 'This is a westbound train.mp3', file: 'transit/west.wav' },
    returnEast: { source: 'This train will now return eastbound.mp3', file: 'transit/return-east.wav' },
    returnWest: { source: 'This train will now return westbound.mp3', file: 'transit/return-west.wav' },
    doors: { source: 'Please stand clear of the closing doors.mp3', file: 'transit/doors.wav' },
    alight: { source: 'Please allow passengers to leave the train before boarding.mp3', file: 'transit/alight.wav' },
    edge: { source: 'Please stand back from the platform edge.mp3', file: 'transit/edge.wav' },
    belongings: { source: 'Please remember to take your belongings with you.mp3', file: 'transit/belongings.wav' }
  },
  stations: {
    'MERCER ST': { source: 'Mercer street.mp3', file: 'transit/mercer-st.wav' },
    'BLEECKER ST': { source: 'Bleecker street.mp3', file: 'transit/bleecker-st.wav' },
    'WATER ST': { source: 'Water street.mp3', file: 'transit/water-st.wav' },
    '8TH AVE': { source: 'Eighth avenue.mp3', file: 'transit/8th-ave.wav' },
    'HOUSTON ST': { source: 'Houston street.mp3', file: 'transit/houston-st.wav' },
    'PEARL ST': { source: 'Pearl street.mp3', file: 'transit/pearl-st.wav' },
    '14TH ST': { source: 'Fourteenth street.mp3', file: 'transit/14th-st.wav' },
    'GRAND ST': { source: 'Grand street.mp3', file: 'transit/grand-st.wav' },
    '2ND AVE': { source: 'Second avenue.mp3', file: 'transit/2nd-ave.wav' },
    '6TH AVE': { source: 'Sixth avenue.mp3', file: 'transit/6th-ave.wav' },
    '5TH ST': { source: 'Fifth street.mp3', file: 'transit/5th-st.wav' },
    '20TH ST': { source: 'Twentieth street.mp3', file: 'transit/20th-st.wav' },
    'HARBOR ST': { source: 'Harbor street.mp3', file: 'transit/harbor-st.wav' },
    '12TH ST': { source: 'Twelfth street.mp3', file: 'transit/12th-st.wav' },
    '23RD ST': { source: 'Twenty-third street.mp3', file: 'transit/23rd-st.wav' },
    'FRONT ST': { source: 'Front street.mp3', file: 'transit/front-st.wav' },
    'HUDSON ST': { source: 'Hudson street.mp3', file: 'transit/hudson-st.wav' },
    'SPRING ST': { source: 'Spring street.mp3', file: 'transit/spring-st.wav' },
    '3RD AVE': { source: 'Third avenue.mp3', file: 'transit/3rd-ave.wav' },
    'KING ST': { source: 'King street.mp3', file: 'transit/king-st.wav' },
    '11TH AVE': { source: 'Eleventh avenue.mp3', file: 'transit/11th-ave.wav' },
    '18TH AVE': { source: 'Eighteenth avenue.mp3', file: 'transit/18th-ave.wav' },
    '26TH AVE': { source: 'Twenty-sixth avenue.mp3', file: 'transit/26th-ave.wav' }
  }
};
const TRANSIT_PA = {
  gap: .075, announcementGap: 2, lead: .025, fade: .008, gain: .855, doorsLead: 4,
  highpass: 380, lowpass: 3800, presence: 2200, presenceGain: 3.5,
  reflectionTime: .022, reflectionGain: .2
};
function transitFiles(phrase, station) {
  const first = TRANSIT_ASSETS.phrases[phrase]?.file;
  if (!first) return null;
  if (station == null) return [first];
  const name = TRANSIT_ASSETS.stations[station]?.file;
  return name ? [first, name] : null;
}
