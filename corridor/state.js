const scene = new THREE.Scene();
scene.background = new THREE.Color(.065, .078, .073);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .06, 110);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// Each canvas pixel covers a whole number of screen pixels (at most 1.5 canvas pixels per CSS pixel).
// A canvas stretched by any fraction duplicates rows and columns of the dither, which show as seams.
function fitCanvas() {
  const ratio = devicePixelRatio || 1, cover = Math.ceil(ratio/1.5);
  const width = Math.floor(innerWidth*ratio/cover), height = Math.floor(innerHeight*ratio/cover);
  renderer.setPixelRatio(1); renderer.setSize(width,height,false);
  renderer.domElement.style.width = width*cover/ratio+'px'; renderer.domElement.style.height = height*cover/ratio+'px';
  camera.aspect = width/height; camera.updateProjectionMatrix();
}
fitCanvas();
document.body.prepend(renderer.domElement);
const clock = new THREE.Clock();
const time = { value: 0 }, powered = { value: 0 }, carLamp = { value: new THREE.Vector3(-33,-18,-50) };
const basinWaterline = { value: -1.7 };
const floors = [], ceilings = [], barriers = [], interactables = [];
const veil = document.getElementById('veil'), enter = document.getElementById('enter');
const enterLabel = document.getElementById('enter-label'), prompt = document.getElementById('prompt');
const altitude = document.getElementById('altitude'), reticle = document.getElementById('reticle');
const coarse = matchMedia('(pointer: coarse)').matches;
const keys = new Set();
const eyeHeight = 1.65, radius = .24, stepHeight = .26;
const player = new THREE.Vector3(0, 0, 3);
let yaw = 0, pitch = 0, playing = false, walked = 0, zone = '', active = null;
let pumpOn = false, descentReleased = false, messageUntil = 0, touchLook = null;
let audio = null, soundOn = true;
let audioZone = null, audioPump = null;
let pumpRotor, pumpWheel, pumpIndicator, descentCap, descentGate, ascentSign, returnSign;
const rampJoins = [];
// The lift car runs between the hub landing and the sump landing. It starts below.
const hubFloor = -1.5, liftLevels = [hubFloor,-21], liftTravel = 10, sheaveY = 7.8, sheaveRadius = 1.125;
let liftPos = 1, liftTarget = 1, liftCar, liftCounterweight, liftSheave, carCable, weightCable;
const liftGates = [], liftRails = [], liftControl = new THREE.Vector3();
// Rooms behind the bulkhead and the north shutter; the plan board draws from these too.
const storePlan = { x0: -24, x1: -16, z0: -40.7, z1: -34.7 }, controlPlan = { x0: -71.3, x1: -61.3, z0: -54, z1: -46 };
let northShutter, southShutter, hatch, bulkheadSign, buttonCap, keyGroup, lockLamp;
let hatchTime = null, hatchOpen = false, keyTaken = false, hasKey = false, southUnlocked = false;
const carry = document.getElementById('carry'), endScreen = document.getElementById('end');
// Pressing the button is remembered: a later visit finds the intake fallen in and the power gone.
const collapseKey = 'corridor-crawler-collapsed';
// ?test=1&spawn=button starts in the chamber; it ignores the memory so the ending can be replayed.
// ?test=1&spawn=surface starts on the stair's top landing, as if the ending were remembered.
const spawn = new URLSearchParams(location.search).has('test') ? new URLSearchParams(location.search).get('spawn') : null;
const collapsed = restarting || spawn === 'surface' || spawn !== 'button' && (() => { try { return localStorage.getItem(collapseKey) === '1'; } catch { return false; } })();
let detonated = false, fuse = 0, booms = 0, ended = false, powerCut = collapsed, frontS = null, shake = 0, roar = null, redButton;
