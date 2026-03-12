window.__TERRARIA_V2__ = true;
window.__TERRARIA_ACTIVE_VERSION__ = 'v2';
document.documentElement.dataset.terrariaEngine = 'v2';
console.info('[terraria] loaded v2');

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const TILE = 16;
const WORLD_W = 420;
const WORLD_H = 170;
const WORLD_PX = WORLD_W * TILE;
const DAY_LENGTH_MS = 180000;
const TARGET_DT = 1000 / 60;
const TAU = Math.PI * 2;

const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const DSTONE = 4;
const COPPER = 5;
const IRON = 6;
const WOOD = 7;
const TREE = 8;
const COAL_ORE = 9;

// Non-block item types
const HELMET = 10;
const CHESTPLATE = 11;
const LEGGINGS = 12;
const BOOTS = 13;
const SWORD_STONE = 14;
const SWORD_IRON = 15;
const PICK_STONE = 16;
const PICK_IRON = 17;
// Placeable structure blocks
const DOOR = 18;
const DOOR_OPEN = 19;
const CHEST = 20;
const FURNACE = 21;
// Crafted items / materials
const COAL = 22;
const COPPER_INGOT = 23;
const IRON_INGOT = 24;
const ARROW = 25;
const AXE_STONE = 26;
const AXE_IRON = 27;
const SHOVEL_STONE = 28;
const SHOVEL_IRON = 29;
const BOW = 30;
const SWORD_COPPER = 31;
const PICK_COPPER = 32;
const AXE_COPPER = 33;
const SHOVEL_COPPER = 34;
// Accessories
const ACC_HERMES_BOOTS = 58;  // +40% move speed
const ACC_CLOUD_BOTTLE = 59;  // double jump
const ACC_HORSESHOE = 60;  // negate fall damage
const ACC_BAND_REGEN = 61;  // slow HP regen
const ACC_FROG_LEG = 62;  // +30% jump height
const ACC_SHACKLE = 63;  // +2 defense
const ACC_ANKH = 64;  // +25% knockback resist
const ACC_NECKLACE = 65;  // +1 max HP
const ACC_AGLET = 66;  // +20% move speed
const ACC_SPECTRE_BOOTS = 67;  // +60% move speed (combine aglet + hermes)
const ACC_SLOTS = 5;
// New ores & ingots
const GOLD_ORE = 35;
const GOLD_INGOT = 36;
const DIAMOND = 37;  // mined raw, no smelting
// Iron armor
const HELMET_IRON = 38;
const CHESTPLATE_IRON = 39;
const LEGGINGS_IRON = 40;
const BOOTS_IRON = 41;
// Gold tools
const SWORD_GOLD = 42;
const PICK_GOLD = 43;
const AXE_GOLD = 44;
const SHOVEL_GOLD = 45;
// Gold armor
const HELMET_GOLD = 46;
const CHESTPLATE_GOLD = 47;
const LEGGINGS_GOLD = 48;
const BOOTS_GOLD = 49;
// Diamond tools
const SWORD_DIAMOND = 50;
const PICK_DIAMOND = 51;
const AXE_DIAMOND = 52;
const SHOVEL_DIAMOND = 53;
// Diamond armor
const HELMET_DIAMOND = 54;
const CHESTPLATE_DIAMOND = 55;
const LEGGINGS_DIAMOND = 56;
const BOOTS_DIAMOND = 57;

const WATER_MAX = 1;
const WATER_RENDER_EPS = 0.04;
const WATER_SIDE_FLOW = 0.35;
const WATER_STEPS_PER_FRAME = 1;
const WATER_MOVE_THRESHOLD = 0.003;
const WATER_SPEED_MULT = 0.72;
const WATER_GRAVITY_MULT = 0.24;
const WATER_MAX_FALL = 3.6;
const WATER_SWIM_ACCEL = 0.78;
const PLAYER_WET_THRESHOLD = 0.25;
const PLAYER_SUBMERGED_THRESHOLD = 0.999;
const PLAYER_MAX_AIR = 60 * 6;
const DROWN_DAMAGE_FRAMES = 45;

const BIOME_FOREST = 0;
const BIOME_MEADOW = 1;
const BIOME_ROCKY = 2;

const blockDefs = {
  [AIR]: { name: 'Empty', solid: false, mine: 0 },
  [GRASS]: { name: 'Grass', solid: true, mine: 10 },
  [DIRT]: { name: 'Dirt', solid: true, mine: 18 },
  [STONE]: { name: 'Stone', solid: true, mine: 34 },
  [DSTONE]: { name: 'Deep Stone', solid: true, mine: 54 },
  [COPPER]: { name: 'Copper Ore', solid: true, mine: 44 },
  [IRON]: { name: 'Iron Ore', solid: true, mine: 56 },
  [WOOD]: { name: 'Wood', solid: true, mine: 16 },
  [TREE]: { name: 'Tree', solid: false, mine: 16, drops: WOOD },
  [COAL_ORE]: { name: 'Coal Ore', solid: true, mine: 28, drops: COAL },
  [GOLD_ORE]: { name: 'Gold Ore', solid: true, mine: 68, drops: GOLD_ORE },
  [DIAMOND]: { name: 'Diamond Ore', solid: true, mine: 90, drops: DIAMOND },
  [DOOR]: { name: 'Door', solid: true, mine: 12, drops: DOOR },
  [DOOR_OPEN]: { name: 'Door', solid: false, mine: 12, drops: DOOR },
  [CHEST]: { name: 'Chest', solid: true, mine: 24, drops: CHEST },
  [FURNACE]: { name: 'Furnace', solid: true, mine: 40, drops: FURNACE },
};

const itemDefs = {
  [HELMET]: { name: 'Helmet', equipSlot: 0 },
  [CHESTPLATE]: { name: 'Chestplate', equipSlot: 1 },
  [LEGGINGS]: { name: 'Leggings', equipSlot: 2 },
  [BOOTS]: { name: 'Boots', equipSlot: 3 },
  [SWORD_STONE]: { name: 'Stone Sword' },
  [SWORD_IRON]: { name: 'Iron Sword' },
  [PICK_STONE]: { name: 'Stone Pickaxe' },
  [PICK_IRON]: { name: 'Iron Pickaxe' },
  [AXE_STONE]: { name: 'Stone Axe' },
  [AXE_IRON]: { name: 'Iron Axe' },
  [SHOVEL_STONE]: { name: 'Stone Shovel' },
  [SHOVEL_IRON]: { name: 'Iron Shovel' },
  [BOW]: { name: 'Bow' },
  [SWORD_COPPER]: { name: 'Copper Sword' },
  [PICK_COPPER]: { name: 'Copper Pickaxe' },
  [AXE_COPPER]: { name: 'Copper Axe' },
  [SHOVEL_COPPER]: { name: 'Copper Shovel' },
  [ACC_HERMES_BOOTS]: { name: 'Hermes Boots', accessory: true },
  [ACC_CLOUD_BOTTLE]: { name: 'Cloud in a Bottle', accessory: true },
  [ACC_HORSESHOE]: { name: 'Lucky Horseshoe', accessory: true },
  [ACC_BAND_REGEN]: { name: 'Band of Regeneration', accessory: true },
  [ACC_FROG_LEG]: { name: 'Frog Leg', accessory: true },
  [ACC_SHACKLE]: { name: 'Shackle', accessory: true },
  [ACC_ANKH]: { name: 'Ankh Charm', accessory: true },
  [ACC_NECKLACE]: { name: 'Necklace', accessory: true },
  [ACC_AGLET]: { name: 'Aglet', accessory: true },
  [ACC_SPECTRE_BOOTS]: { name: 'Spectre Boots', accessory: true },
  [GOLD_INGOT]: { name: 'Gold Ingot' },
  [DIAMOND]: { name: 'Diamond' },
  [HELMET_IRON]: { name: 'Iron Helmet', equipSlot: 0 },
  [CHESTPLATE_IRON]: { name: 'Iron Chestplate', equipSlot: 1 },
  [LEGGINGS_IRON]: { name: 'Iron Leggings', equipSlot: 2 },
  [BOOTS_IRON]: { name: 'Iron Boots', equipSlot: 3 },
  [SWORD_GOLD]: { name: 'Gold Sword' },
  [PICK_GOLD]: { name: 'Gold Pickaxe' },
  [AXE_GOLD]: { name: 'Gold Axe' },
  [SHOVEL_GOLD]: { name: 'Gold Shovel' },
  [HELMET_GOLD]: { name: 'Gold Helmet', equipSlot: 0 },
  [CHESTPLATE_GOLD]: { name: 'Gold Chestplate', equipSlot: 1 },
  [LEGGINGS_GOLD]: { name: 'Gold Leggings', equipSlot: 2 },
  [BOOTS_GOLD]: { name: 'Gold Boots', equipSlot: 3 },
  [SWORD_DIAMOND]: { name: 'Diamond Sword' },
  [PICK_DIAMOND]: { name: 'Diamond Pickaxe' },
  [AXE_DIAMOND]: { name: 'Diamond Axe' },
  [SHOVEL_DIAMOND]: { name: 'Diamond Shovel' },
  [HELMET_DIAMOND]: { name: 'Diamond Helmet', equipSlot: 0 },
  [CHESTPLATE_DIAMOND]: { name: 'Diamond Chestplate', equipSlot: 1 },
  [LEGGINGS_DIAMOND]: { name: 'Diamond Leggings', equipSlot: 2 },
  [BOOTS_DIAMOND]: { name: 'Diamond Boots', equipSlot: 3 },
  [COAL]: { name: 'Coal' },
  [COPPER_INGOT]: { name: 'Copper Ingot' },
  [IRON_INGOT]: { name: 'Iron Ingot' },
  [ARROW]: { name: 'Arrow' },
  [DOOR]: { name: 'Door' },
  [CHEST]: { name: 'Chest' },
  [FURNACE]: { name: 'Furnace' },
};

function getItemName(type) {
  return blockDefs[type]?.name ?? itemDefs[type]?.name ?? 'Item';
}

const armorDefs = {
  // Copper
  [HELMET]: { defense: 1 }, [CHESTPLATE]: { defense: 3 }, [LEGGINGS]: { defense: 2 }, [BOOTS]: { defense: 1 },
  // Iron
  [HELMET_IRON]: { defense: 2 }, [CHESTPLATE_IRON]: { defense: 5 }, [LEGGINGS_IRON]: { defense: 3 }, [BOOTS_IRON]: { defense: 2 },
  // Gold
  [HELMET_GOLD]: { defense: 3 }, [CHESTPLATE_GOLD]: { defense: 7 }, [LEGGINGS_GOLD]: { defense: 5 }, [BOOTS_GOLD]: { defense: 3 },
  // Diamond
  [HELMET_DIAMOND]: { defense: 4 }, [CHESTPLATE_DIAMOND]: { defense: 9 }, [LEGGINGS_DIAMOND]: { defense: 7 }, [BOOTS_DIAMOND]: { defense: 4 },
};
const accessories = Array.from({ length: ACC_SLOTS }, () => createStack());

function hasAccessory(type) {
  return accessories.some(s => s.type === type);
}

function getTotalDefense() {
  const armor = equipment.reduce((s, slot) => s + (armorDefs[slot.type]?.defense ?? 0), 0);
  const acc = hasAccessory(ACC_SHACKLE) ? 2 : 0;
  return armor + acc;
}

function getSpeedMult() {
  if (hasAccessory(ACC_SPECTRE_BOOTS)) return 1.6;
  let m = 1.0;
  if (hasAccessory(ACC_HERMES_BOOTS)) m += 0.4;
  if (hasAccessory(ACC_AGLET)) m += 0.2;
  return m;
}

function getJumpMult() {
  return hasAccessory(ACC_FROG_LEG) ? 1.3 : 1.0;
}

function getMaxHealth() {
  return player.maxHealth + (hasAccessory(ACC_NECKLACE) ? 1 : 0);
}

// Called wherever player takes damage — applies Terraria-style defense reduction
function applyDamageToPlayer(rawDmg) {
  if (player.iframes > 0 || player.dying) return;
  const defense = getTotalDefense();
  const reduced = Math.max(1, rawDmg - Math.floor(defense / 2));
  player.health = Math.max(0, player.health - reduced);
  player.iframes = 45;
}

function getToolMultiplier(blockType) {
  const held = inventory.hotbar[inventory.selected]?.type ?? AIR;
  const stoneBlocks = [STONE, DSTONE, COPPER, IRON, COAL_ORE, GOLD_ORE, DIAMOND, FURNACE];
  // Pickaxes
  if (held === PICK_DIAMOND && stoneBlocks.includes(blockType)) return 7.0;
  if (held === PICK_GOLD && stoneBlocks.includes(blockType)) return 5.0;
  if (held === PICK_IRON && stoneBlocks.includes(blockType)) return 3.5;
  if (held === PICK_STONE && stoneBlocks.includes(blockType)) return 2.5;
  if (held === PICK_COPPER && stoneBlocks.includes(blockType)) return 1.5;
  // Axes
  const woodBlocks = [WOOD, TREE];
  if (held === AXE_DIAMOND && woodBlocks.includes(blockType)) return 7.0;
  if (held === AXE_GOLD && woodBlocks.includes(blockType)) return 5.0;
  if (held === AXE_IRON && woodBlocks.includes(blockType)) return 3.5;
  if (held === AXE_STONE && woodBlocks.includes(blockType)) return 2.5;
  if (held === AXE_COPPER && woodBlocks.includes(blockType)) return 1.5;
  // Shovels
  const dirtBlocks = [DIRT, GRASS];
  if (held === SHOVEL_DIAMOND && dirtBlocks.includes(blockType)) return 7.0;
  if (held === SHOVEL_GOLD && dirtBlocks.includes(blockType)) return 5.0;
  if (held === SHOVEL_IRON && dirtBlocks.includes(blockType)) return 3.5;
  if (held === SHOVEL_STONE && dirtBlocks.includes(blockType)) return 2.5;
  if (held === SHOVEL_COPPER && dirtBlocks.includes(blockType)) return 1.5;
  return 1;
}

// ─── CHEST / FURNACE / DOOR STATE ─────────────────────────────────────────────
const CHEST_SLOTS = 20; // 4 rows of 5
const chests = new Map();   // blockIndex → Array<Stack>
const furnaces = new Map(); // blockIndex → FurnaceState
let openUI = null; // null | { type:'chest'|'furnace', key, wx, wy }

const SMELT_RECIPES = {
  [COPPER]: { out: COPPER_INGOT, time: 150 },
  [IRON]: { out: IRON_INGOT, time: 180 },
  [GOLD_ORE]: { out: GOLD_INGOT, time: 220 },
};

function createFurnaceState() {
  return { ore: createStack(), fuel: createStack(), out: createStack(), timer: 0 };
}

function isInteractable(type) {
  return type === DOOR || type === DOOR_OPEN || type === CHEST || type === FURNACE;
}

function blockKey(wx, wy) { return wy * WORLD_W + wx; }

function handleWorldRightClick() {
  if (openUI) return;
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  if (Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy) > MINE_RADIUS_PX) return;

  const type = getBlock(wx, wy);
  const key = blockKey(wx, wy);
  if (type === DOOR) { if (!inventory.open) { setBlock(wx, wy, DOOR_OPEN); return; } }
  if (type === DOOR_OPEN) { if (!inventory.open) { setBlock(wx, wy, DOOR); return; } }
  if (type === CHEST) {
    if (!chests.has(key)) chests.set(key, Array.from({ length: CHEST_SLOTS }, () => createStack()));
    openUI = { type: 'chest', key, wx, wy, wasInventoryOpen: inventory.open };
    inventory.open = true;
    return;
  }
  if (type === FURNACE) {
    if (!furnaces.has(key)) furnaces.set(key, createFurnaceState());
    openUI = { type: 'furnace', key, wx, wy, wasInventoryOpen: inventory.open };
    inventory.open = true;
    return;
  }

}

// ─── ARROW PROJECTILES ────────────────────────────────────────────────────────
const arrowEntities = [];
let bowCooldown = 0;

function fireArrow() {
  if (player.dying || player.health <= 0) return;
  if (bowCooldown > 0) return;
  const held = inventory.hotbar[inventory.selected];
  if (!held || held.type !== BOW) return;
  let arrowSlot = null;
  for (const s of [...inventory.hotbar, ...inventory.backpack]) {
    if (s.type === ARROW && s.count > 0) { arrowSlot = s; break; }
  }
  if (!arrowSlot) return;
  arrowSlot.count--;
  if (arrowSlot.count <= 0) setStack(arrowSlot, createStack());

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const tx = mouse.x + Math.round(cam.x);
  const ty = mouse.y + Math.round(cam.y);
  const dx = tx - pcx, dy = ty - pcy;
  const dist = Math.hypot(dx, dy) || 1;
  const spd = 13;
  arrowEntities.push({ x: pcx, y: pcy, vx: dx / dist * spd, vy: dy / dist * spd, life: 240 });
  bowCooldown = 20;
}

function updateArrows(scale) {
  if (bowCooldown > 0) bowCooldown = Math.max(0, bowCooldown - scale);
  for (let i = arrowEntities.length - 1; i >= 0; i--) {
    const a = arrowEntities[i];
    a.x += a.vx * scale;
    a.y += a.vy * scale;
    a.vy += 0.28 * scale;
    a.life -= scale;
    if (isSolid(getBlock(Math.floor(a.x / TILE), Math.floor(a.y / TILE))) || a.life <= 0) {
      arrowEntities.splice(i, 1);
    }
  }
}

function drawArrows() {
  if (arrowEntities.length === 0) return;
  ctx.save();
  ctx.strokeStyle = '#c8a062';
  ctx.lineWidth = 2;
  for (const a of arrowEntities) {
    const sx = a.x - cam.x, sy = a.y - cam.y;
    const angle = Math.atan2(a.vy, a.vx);
    ctx.beginPath();
    ctx.moveTo(sx - Math.cos(angle) * 8, sy - Math.sin(angle) * 8);
    ctx.lineTo(sx + Math.cos(angle) * 5, sy + Math.sin(angle) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function updateFurnaces(scale) {
  for (const [, f] of furnaces) {
    const recipe = SMELT_RECIPES[f.ore.type];
    const hasFuel = !isEmptyStack(f.fuel) && f.fuel.type === COAL;
    const canOut = isEmptyStack(f.out) || (f.out.type === recipe?.out && f.out.count < STACK_LIMIT);
    if (recipe && hasFuel && canOut) {
      f.timer += scale;
      if (f.timer >= recipe.time) {
        f.timer = 0;
        f.fuel.count--; if (f.fuel.count <= 0) setStack(f.fuel, createStack());
        f.ore.count--; if (f.ore.count <= 0) setStack(f.ore, createStack());
        if (isEmptyStack(f.out)) setStack(f.out, createStack(recipe.out, 1));
        else f.out.count++;
      }
    } else {
      f.timer = 0;
    }
  }
}

// ─── SLIME ENEMIES ────────────────────────────────────────────────────────────
const slimeSprites = Array.from({ length: 16 }, (_, i) => {
  const img = new Image();
  img.src = `images/mineria/slime Sprites/slime${i + 1}.png`;
  return img;
});
const slimes = [];
const SLIME_W = 20, SLIME_H = 16;
const SLIME_MAX = 5;
const SLIME_JUMP_INTERVAL_MIN = 80, SLIME_JUMP_INTERVAL_MAX = 180;
const SLIME_JUMP_VEL = -9.0;
const SLIME_WALK_SPEED = 1.2;

function getSlimeSpawnDistMin() {
  return Math.max(canvas.width / 2 + TILE * 3, canvas.width * 0.6);
}

function getSlimeSpawnDistMax() {
  return Math.max(getSlimeSpawnDistMin() + TILE * 8, canvas.width * 1.2);
}

function getSlimeDespawnDist(slime) {
  const base = Math.max(getSlimeSpawnDistMax() * 2, canvas.width * 2.5);
  return slime.seen ? base : base * 2;
}

function isSlimeOnScreen(slime) {
  return slime.x + SLIME_W > cam.x && slime.x < cam.x + canvas.width &&
    slime.y + SLIME_H > cam.y && slime.y < cam.y + canvas.height;
}

function spawnSlime() {
  if (slimes.length >= SLIME_MAX) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  const spawnMin = getSlimeSpawnDistMin();
  const spawnMax = getSlimeSpawnDistMax();
  const spawnDist = spawnMin + Math.random() * Math.max(1, spawnMax - spawnMin);
  const wx = Math.floor((player.x + player.w / 2 + side * spawnDist) / TILE);
  const clampedWx = Math.max(2, Math.min(WORLD_W - 3, wx));
  // Find surface at that x
  let wy = surfaceYs[clampedWx] ?? 10;
  if (wy < 2) wy = 2;
  const hue = 100 + Math.floor(Math.random() * 80); // green-ish
  slimes.push({
    x: clampedWx * TILE + (TILE - SLIME_W) / 2,
    y: (wy - 1) * TILE - SLIME_H,
    vy: 0,
    onGround: false,
    health: 3,
    maxHealth: 3,
    jumpTick: Math.floor(Math.random() * SLIME_JUMP_INTERVAL_MAX),
    iframes: 0,
    hue,
    seen: false,
    squish: 0, // 0=normal, >0 squishing down on land
    animTick: 0,
    animFrame: 0,
    facing: 1,
    isAttacking: 0
  });
}

function getWeaponDamage() {
  const held = inventory.hotbar[inventory.selected]?.type ?? AIR;
  if (held === SWORD_DIAMOND) return 9;
  if (held === SWORD_GOLD) return 6;
  if (held === SWORD_IRON) return 4;
  if (held === SWORD_STONE) return 3;
  if (held === SWORD_COPPER) return 2;
  if (held === AXE_DIAMOND) return 4;
  if (held === AXE_GOLD) return 3;
  if (held === AXE_IRON) return 2;
  if (held === AXE_STONE) return 1;
  if (held === AXE_COPPER) return 1;
  if (held === PICK_IRON || held === PICK_COPPER || held === PICK_STONE ||
    held === PICK_GOLD || held === PICK_DIAMOND) return 1;
  return 0;
}

function meleeAttackSlimes() {
  if (player.dying || player.health <= 0) return;
  const dmg = getWeaponDamage();
  if (dmg === 0) return;
  const held = inventory.hotbar[inventory.selected]?.type ?? AIR;
  const isSword = held === SWORD_COPPER || held === SWORD_STONE || held === SWORD_IRON || held === SWORD_GOLD || held === SWORD_DIAMOND;
  // Swords use a wide arc from the player; other weapons need to click near the slime
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  const tx = mouse.x + Math.round(cam.x), ty = mouse.y + Math.round(cam.y);
  const swingReach = isSword ? TILE * 4.5 : MINE_RADIUS_PX;
  if (Math.hypot(tx - pcx, ty - pcy) > swingReach) return;
  for (const s of slimes) {
    const scx = s.x + SLIME_W / 2, scy = s.y + SLIME_H / 2;
    if (s.iframes > 0) continue;
    let hit = false;
    if (isSword) {
      // Sword hits everything within a generous radius of the player in the click direction
      hit = Math.hypot(scx - pcx, scy - pcy) < TILE * 4;
    } else {
      hit = Math.abs(tx - scx) < SLIME_W + 8 && Math.abs(ty - scy) < SLIME_H + 8;
    }
    if (hit) {
      s.health -= dmg;
      s.iframes = 20;
      s.vy = -5;
    }
  }
}

function updateSlimes(scale) {
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;

  // Animation update
  for (const s of slimes) {
    s.animTick += scale;
    if (s.animTick > 10) {
      s.animFrame = (s.animFrame + 1) % 4;
      s.animTick = 0;
    }
  }

  // Keep freshly spawned slimes alive until they have a chance to enter view.
  for (let i = slimes.length - 1; i >= 0; i--) {
    const s = slimes[i];
    if (isSlimeOnScreen(s)) s.seen = true;
    const dx = Math.abs((s.x + SLIME_W / 2) - pcx);
    if (dx > getSlimeDespawnDist(s)) { slimes.splice(i, 1); continue; }
    if (s.health <= 0) { slimes.splice(i, 1); continue; }
  }

  // Spawn logic ~every 3s
  if (Math.random() < 0.004 * scale) spawnSlime();

  for (const s of slimes) {
    if (s.iframes > 0) s.iframes = Math.max(0, s.iframes - scale);
    s.squish = Math.max(0, s.squish - 0.08 * scale);

    // Gravity
    s.vy = Math.min(s.vy + GRAVITY * scale, MAX_FALL);
    s.y += s.vy * scale;

    // Vertical collision
    const left = Math.floor(s.x / TILE);
    const right = Math.floor((s.x + SLIME_W - 1) / TILE);
    const bottom = Math.floor((s.y + SLIME_H - 1) / TILE);
    const top = Math.floor(s.y / TILE);

    s.onGround = false;
    if (s.vy >= 0) {
      if (isSolid(getBlock(left, bottom)) || isSolid(getBlock(right, bottom))) {
        s.y = bottom * TILE - SLIME_H;
        s.vy = 0;
        s.onGround = true;
        s.squish = 1;
      }
    } else {
      if (isSolid(getBlock(left, top)) || isSolid(getBlock(right, top))) {
        s.y = (top + 1) * TILE;
        s.vy = 0;
      }
    }

    // Jump AI
    if (s.onGround) {
      s.jumpTick -= scale;
      const scx = s.x + SLIME_W / 2;
      const dir = pcx > scx ? 1 : -1;
      s.facing = -dir; // Sprites face left by default
      // Horizontal drift toward player while on ground
      s.x += dir * SLIME_WALK_SPEED * scale * 0.3;
      if (s.jumpTick <= 0) {
        s.vy = SLIME_JUMP_VEL;
        s.x += dir * SLIME_WALK_SPEED * scale * 2;
        s.jumpTick = SLIME_JUMP_INTERVAL_MIN + Math.random() * (SLIME_JUMP_INTERVAL_MAX - SLIME_JUMP_INTERVAL_MIN);
      }
    } else {
      // Horizontal movement in air
      const scx = s.x + SLIME_W / 2;
      const dir = pcx > scx ? 1 : -1;
      s.facing = -dir;
      s.x += dir * SLIME_WALK_SPEED * scale;
    }

    // Horizontal wall collision
    const midY = Math.floor((s.y + SLIME_H / 2) / TILE);
    const lx = Math.floor(s.x / TILE);
    const rx = Math.floor((s.x + SLIME_W - 1) / TILE);
    if (isSolid(getBlock(lx, midY))) s.x = (lx + 1) * TILE;
    if (isSolid(getBlock(rx, midY))) s.x = rx * TILE - SLIME_W;

    // Clamp to world
    s.x = Math.max(0, Math.min(WORLD_PX - SLIME_W, s.x));

    // Damage player on touch
    if (s.isAttacking > 0) s.isAttacking -= scale;

    if (!player.dying) {
      if (s.x < player.x + player.w && s.x + SLIME_W > player.x &&
        s.y < player.y + player.h && s.y + SLIME_H > player.y) {
        applyDamageToPlayer(2);
        if (player.iframes >= 45) { // Just took damage this frame
          player.vy = -6; // knockback only if damage landed
        }
        s.isAttacking = 15; // Stay in attack animation for a few frames
      }
    }
  }

  // Arrow hits on slimes
  for (let ai = arrowEntities.length - 1; ai >= 0; ai--) {
    const a = arrowEntities[ai];
    for (const s of slimes) {
      if (a.x > s.x && a.x < s.x + SLIME_W && a.y > s.y && a.y < s.y + SLIME_H) {
        s.health -= 3; // bow does 3 damage
        s.iframes = 15;
        s.vy = -4;
        arrowEntities.splice(ai, 1);
        break;
      }
    }
  }
}

function drawSlimes() {
  if (slimes.length === 0) return;
  ctx.save();
  for (const s of slimes) {
    const sx = Math.round(s.x - cam.x);
    const sy = Math.round(s.y - cam.y);
    const flash = s.iframes > 0 && Math.floor(s.iframes / 3) % 2 === 1;

    let animGroup = 0; // 0: idle, 1: move, 2: attack, 3: hurt
    if (s.iframes > 0) animGroup = 3;
    else if (s.isAttacking > 0) animGroup = 2; // attack
    else if (!s.onGround || Math.abs(s.x - s.lastX) > 0.1 || s.jumpTick < SLIME_JUMP_INTERVAL_MIN + 10) animGroup = 1; // move
    else animGroup = 0; // idle

    s.lastX = s.x; // Track movement for next frame

    const frameIdx = animGroup * 4 + s.animFrame;
    const img = slimeSprites[frameIdx];

    if (!img.complete || img.naturalWidth === 0) {
      // Fallback
      const alpha = flash ? 0.4 : 0.82;
      ctx.fillStyle = flash ? `hsla(0,80%,65%,${alpha})` : `hsla(${s.hue},70%,50%,${alpha})`;
      ctx.fillRect(sx, sy, SLIME_W, SLIME_H);
    } else {
      const drawW = img.naturalWidth || 32;
      const drawH = img.naturalHeight || 32;
      const dx = sx + SLIME_W / 2;
      const dy = sy + SLIME_H; // Align bottom edge

      ctx.save();
      ctx.translate(dx, dy);
      if (s.facing === -1) ctx.scale(-1, 1); // Flip based on facing
      if (flash) ctx.globalAlpha = 0.5;

      // Draw centered horizontally, aligned to bottom vertically
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
      ctx.restore();
    }

    // Health bar (only if damaged)
    if (s.health < s.maxHealth) {
      const bw = SLIME_W + 4, bh = 3;
      const bx = sx - 2, by = sy - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#44dd44';
      ctx.fillRect(bx, by, Math.round(bw * s.health / s.maxHealth), bh);
    }
  }
  ctx.restore();
}

const biomeNames = {
  [BIOME_FOREST]: 'Forest',
  [BIOME_MEADOW]: 'Meadow',
  [BIOME_ROCKY]: 'Rocky Hills',
};

const biomeGrassTints = {
  [BIOME_FOREST]: '#67bf45',
  [BIOME_MEADOW]: '#8ad860',
  [BIOME_ROCKY]: '#78ad46',
};

const world = new Uint8Array(WORLD_W * WORLD_H);
const water = new Float32Array(WORLD_W * WORLD_H);
const surfaceYs = new Int16Array(WORLD_W);
const biomes = new Uint8Array(WORLD_W);
const treeCanopies = [];
const tileTextures = {};
const wallTextures = {};
const stars = [];
const clouds = [];
const mountainLayers = [];
const cam = { x: 0, y: 0 };

let lastTime = 0;
let dayClockMs = DAY_LENGTH_MS * 0.22;
let waterFlowParity = 0;

// ─── GAME STATE ───────────────────────────────────────────────────────────────
let gameState = 'mainmenu'; // 'mainmenu' | 'playing' | 'paused'
let currentSaveSlot = -1;
let saveMessageTimer = 0;
let menuConfirm = null; // 'newworld' when showing confirm dialog
const SAVE_KEY_PREFIX = 'terraria_v2_slot_';
const audioManager = typeof window.TerrariaAudioManager === 'function'
  ? new window.TerrariaAudioManager({
    menuTrack: {
      src: 'audio/mineria/intro.mp3',
      baseVolume: 0.46,
      gameplayBaseVolume: 0.72,
      filterFrequency: 920,
      filterQ: 0.9,
    },
    gameplayTracks: [
      { id: 'a-chill-fever', src: 'audio/mineria/a_chill_fever.mp3' },
      { id: 'binary-village', src: 'audio/mineria/binary_village.mp3' },
      { id: 'cave-3', src: 'audio/mineria/cave_3.mp3' },
      { id: 'look-trippy', src: 'audio/mineria/look_trippy.mp3' },
    ],
    initialGameplayDelayMs: 12000,
    gameplayPauseMinMs: 65000,
    gameplayPauseMaxMs: 98000,
    fadeInMs: 3200,
    fadeOutMs: 3600,
    defaultMasterVolume: 0.78,
    defaultMusicVolume: 0.88,
  })
  : null;
const audioUi = { draggingKey: null };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncAudioState() {
  if (audioManager) audioManager.syncState(gameState);
}

function setGameState(nextState) {
  if (gameState === nextState) return;
  clearMenuAudioDrag();
  gameState = nextState;
  syncAudioState();
}

syncAudioState();

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash(n) {
  return Math.abs((Math.sin(n * 127.1 + 311.7) * 43758.5453123) % 1);
}

function hash2(x, y, seed = 0) {
  return hash(x * 374761 + y * 668265 + seed * 69069);
}

function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function octaveNoise(x, octaves, persistence) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    value += smoothNoise(x * frequency) * amplitude;
    total += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / total;
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mixColor(a, b, t, alpha = 1) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const rgb = ra.map((value, i) => Math.round(value + (rb[i] - value) * t));
  return alpha === 1
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function alphaColor(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shiftColor(hex, delta) {
  const [r, g, b] = hexToRgb(hex);
  const amount = Math.round(255 * delta);
  return `rgb(${clamp(r + amount, 0, 255)},${clamp(g + amount, 0, 255)},${clamp(b + amount, 0, 255)})`;
}

function makeCanvas(size = TILE) {
  const texture = document.createElement('canvas');
  texture.width = size;
  texture.height = size;
  const g = texture.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { texture, g };
}

function pixel(g, x, y, color, w = 1, h = 1) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function isSolid(type) {
  return !!blockDefs[type]?.solid;
}

function hasBlock(type) {
  return type !== AIR;
}

function getBlock(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return STONE;
  return world[x + y * WORLD_W];
}

function setBlock(x, y, type) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  world[x + y * WORLD_W] = type;
}

function waterIndex(x, y) {
  return x + y * WORLD_W;
}

function getWater(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return 0;
  return water[waterIndex(x, y)];
}

function setWater(x, y, amount) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  water[waterIndex(x, y)] = clamp(amount, 0, WATER_MAX);
}

function isWaterCell(x, y, threshold = WATER_RENDER_EPS) {
  return getWater(x, y) > threshold;
}

function canWaterOccupy(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  return !isSolid(getBlock(x, y));
}

function isMineable(type) {
  return (blockDefs[type]?.mine || 0) > 0;
}

function getDropType(type) {
  return blockDefs[type]?.drops || type;
}

function breakTreeFrom(x, y) {
  let broken = 0;
  for (let treeY = y; treeY >= 0 && getBlock(x, treeY) === TREE; treeY--) {
    setBlock(x, treeY, AIR);
    broken++;
  }
  return broken;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}

function chooseBiome(previous) {
  let biome = Math.floor(Math.random() * 3);
  if (biome === previous) {
    biome = (biome + 1 + Math.floor(Math.random() * 2)) % 3;
  }
  return biome;
}

function generateBiomeBands() {
  let x = 0;
  let previous = BIOME_FOREST;
  while (x < WORLD_W) {
    const span = 58 + Math.floor(Math.random() * 78);
    const biome = chooseBiome(previous);
    for (let i = x; i < Math.min(WORLD_W, x + span); i++) biomes[i] = biome;
    previous = biome;
    x += span;
  }

  const center = Math.floor(WORLD_W / 2);
  for (let i = 0; i < 24; i++) {
    biomes[i] = BIOME_FOREST;
    biomes[WORLD_W - 1 - i] = BIOME_ROCKY;
  }
  for (let xPos = center - 18; xPos <= center + 18; xPos++) {
    biomes[clamp(xPos, 0, WORLD_W - 1)] = BIOME_MEADOW;
  }
}

function groundHeightAt(x) {
  const biome = biomes[x];
  const primary = octaveNoise((x + 320) / 68, 4, 0.53);
  const detail = octaveNoise((x + 900) / 15, 2, 0.38);
  const ridge = biome === BIOME_ROCKY ? octaveNoise((x + 70) / 9, 2, 0.42) * 5 : 0;
  const biomeOffset = biome === BIOME_ROCKY ? 5 : biome === BIOME_MEADOW ? -2 : 0;
  return Math.floor(44 + primary * 20 + detail * 4 + ridge + biomeOffset);
}

function digAirWorm(startX, startY, length, radius, angle, depthGuard = 4) {
  let wx = startX;
  let wy = startY;
  for (let i = 0; i < length; i++) {
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const bx = Math.round(wx + dx);
        const by = Math.round(wy + dy);
        if (bx < 1 || bx >= WORLD_W - 1 || by < 1 || by >= WORLD_H - 2) continue;
        if (by >= surfaceYs[clamp(bx, 0, WORLD_W - 1)] + depthGuard) setBlock(bx, by, AIR);
      }
    }
    angle += (Math.random() - 0.5) * 0.48;
    wx += Math.cos(angle) * 1.45;
    wy += Math.sin(angle) * 0.72;
    radius = clamp(radius + (Math.random() - 0.5) * 0.14, 1.0, 3.5);
    if (wx < 2 || wx > WORLD_W - 3 || wy < 5 || wy > WORLD_H - 5) break;
  }
}

function paintOreVein(type, startX, startY, length, radius, angle) {
  let wx = startX;
  let wy = startY;
  for (let i = 0; i < length; i++) {
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const bx = Math.round(wx + dx);
        const by = Math.round(wy + dy);
        if (bx < 1 || bx >= WORLD_W - 1 || by < 1 || by >= WORLD_H - 2) continue;
        const current = getBlock(bx, by);
        if ((current === STONE || current === DSTONE || current === DIRT) && by >= surfaceYs[bx] + 7) {
          setBlock(bx, by, type);
        }
      }
    }
    angle += (Math.random() - 0.5) * 0.8;
    wx += Math.cos(angle) * 1.18;
    wy += Math.sin(angle) * 0.85;
    radius = clamp(radius + (Math.random() - 0.5) * 0.14, 1, 3.3);
    if (wx < 2 || wx > WORLD_W - 3 || wy < 7 || wy > WORLD_H - 6) break;
  }
}

function spawnOres() {
  // Coal: common, near surface
  for (let i = 0; i < 55; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 5 + Math.floor(Math.random() * 55);
    paintOreVein(COAL_ORE, x, y, 12 + Math.floor(Math.random() * 10), 1.2 + Math.random() * 0.6, Math.random() * TAU);
  }
  // Copper: moderate, shallow-mid
  for (let i = 0; i < 38; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 8 + Math.floor(Math.random() * 40);
    paintOreVein(COPPER, x, y, 10 + Math.floor(Math.random() * 10), 1.1 + Math.random() * 0.7, Math.random() * TAU);
  }
  // Iron: less common, mid depth
  for (let i = 0; i < 24; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 28 + Math.floor(Math.random() * 50);
    paintOreVein(IRON, x, y, 8 + Math.floor(Math.random() * 10), 1.1 + Math.random() * 0.8, Math.random() * TAU);
  }
  // Gold: rare, deep
  for (let i = 0; i < 14; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 55 + Math.floor(Math.random() * 55);
    paintOreVein(GOLD_ORE, x, y, 6 + Math.floor(Math.random() * 8), 1.0 + Math.random() * 0.7, Math.random() * TAU);
  }
  // Diamond: very rare, deepest
  for (let i = 0; i < 7; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 90 + Math.floor(Math.random() * 40);
    paintOreVein(DIAMOND, x, y, 4 + Math.floor(Math.random() * 5), 0.9 + Math.random() * 0.5, Math.random() * TAU);
  }
}

function columnHasSurfaceWater(x) {
  const tileX = clamp(x, 0, WORLD_W - 1);
  const surface = surfaceYs[tileX];
  for (let y = Math.max(0, surface - 8); y <= Math.min(WORLD_H - 1, surface); y++) {
    if (isWaterCell(tileX, y)) return true;
  }
  return false;
}

function carvePondColumn(x, floorY, waterline) {
  const tileX = clamp(x, 0, WORLD_W - 1);
  const oldSurface = surfaceYs[tileX];
  const clampedFloor = clamp(Math.max(oldSurface, floorY), 3, WORLD_H - 6);

  for (let y = oldSurface; y < clampedFloor; y++) setBlock(tileX, y, AIR);

  const topType = clampedFloor > waterline ? DIRT : GRASS;
  setBlock(tileX, clampedFloor, topType);
  for (let y = clampedFloor + 1; y < Math.min(WORLD_H, clampedFloor + 4); y++) {
    const current = getBlock(tileX, y);
    if (current === AIR || current === GRASS) setBlock(tileX, y, DIRT);
  }

  for (let y = waterline; y < clampedFloor; y++) setWater(tileX, y, WATER_MAX);
  surfaceYs[tileX] = clampedFloor;
}

function trySpawnSurfacePond(seedX, widthBias = 0) {
  let centerX = clamp(seedX, 14, WORLD_W - 15);
  for (let x = Math.max(8, centerX - 6); x <= Math.min(WORLD_W - 9, centerX + 6); x++) {
    if (surfaceYs[x] > surfaceYs[centerX]) centerX = x;
  }

  const width = 5 + widthBias + Math.floor(hash(centerX * 17) * 3);
  const left = centerX - width;
  const right = centerX + width;
  if (left < 5 || right > WORLD_W - 6) return false;

  const biome = biomes[centerX];
  if (biome === BIOME_ROCKY && hash(centerX * 31) > 0.35) return false;

  for (let x = left - 2; x <= right + 2; x++) {
    if (columnHasSurfaceWater(x)) return false;
  }

  const centerY = surfaceYs[centerX];
  const waterline = Math.max(surfaceYs[left], surfaceYs[right]) + 1;
  const baseDepth = biome === BIOME_MEADOW ? 4 : biome === BIOME_FOREST ? 5 : 3;
  const targetDepth = baseDepth + Math.floor(hash(centerX * 47) * 2);

  let filled = 0;

  for (let x = left; x <= right; x++) {
    const offset = Math.abs(x - centerX);
    const edgeT = offset / width;
    const bowl = Math.max(0, 1 - edgeT * edgeT);
    const floorDepth = Math.max(0, Math.round(bowl * targetDepth) - (edgeT > 0.82 ? 1 : 0));
    const targetFloor = waterline + floorDepth;
    carvePondColumn(x, targetFloor, waterline);

    for (let y = waterline; y < surfaceYs[x]; y++) {
      if (isWaterCell(x, y)) filled++;
    }
  }

  return filled > 24 && surfaceYs[centerX] >= waterline + 2 && centerY <= surfaceYs[centerX];
}

function spawnWaterPools() {
  water.fill(0);
  let ponds = 0;
  const bands = 7;

  for (let band = 0; band < bands; band++) {
    const minX = 18 + Math.floor((WORLD_W - 36) * band / bands);
    const maxX = 18 + Math.floor((WORLD_W - 36) * (band + 1) / bands);
    let created = false;

    for (let attempt = 0; attempt < 7 && !created; attempt++) {
      const seed = minX + Math.floor(Math.random() * Math.max(1, maxX - minX));
      created = trySpawnSurfacePond(seed, attempt > 3 ? 1 : 0);
    }

    if (created) ponds++;
  }

  for (let i = 0; i < 48 && ponds < 8; i++) {
    const seed = 16 + Math.floor(Math.random() * (WORLD_W - 32));
    if (trySpawnSurfacePond(seed, i > 24 ? 1 : 0)) ponds++;
  }
}

function plantTrees() {
  treeCanopies.length = 0;
  const center = Math.floor(WORLD_W / 2);
  for (let x = 6; x < WORLD_W - 6; x++) {
    if (Math.abs(x - center) < 14) continue;
    if (getBlock(x, surfaceYs[x]) !== GRASS) continue;
    if (Math.abs(surfaceYs[x] - surfaceYs[x - 1]) > 1 || Math.abs(surfaceYs[x] - surfaceYs[x + 1]) > 1) continue;
    if (columnHasSurfaceWater(x - 1) || columnHasSurfaceWater(x) || columnHasSurfaceWater(x + 1)) continue;

    const biome = biomes[x];
    const chance = biome === BIOME_FOREST ? 0.12 : biome === BIOME_MEADOW ? 0.07 : 0.018;
    if (Math.random() > chance) continue;

    const trunkHeight = biome === BIOME_FOREST ? 5 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 3);
    for (let y = surfaceYs[x] - 1; y >= surfaceYs[x] - trunkHeight; y--) setBlock(x, y, TREE);

    treeCanopies.push({
      x,
      trunkTopY: surfaceYs[x] - trunkHeight,
      trunkBaseY: surfaceYs[x],
      radius: biome === BIOME_FOREST ? 2 + Math.floor(Math.random() * 2) : 2,
      biome,
    });

    x += 4 + Math.floor(Math.random() * 6);
  }
}

function buildMountainLayer(base, amplitude, scaleX, seed, parallax, dayColor, nightColor) {
  const profile = new Float32Array(WORLD_W);
  for (let x = 0; x < WORLD_W; x++) {
    const broad = octaveNoise((x + seed) / scaleX, 4, 0.54);
    const detail = octaveNoise((x + seed * 3) / 14, 2, 0.4);
    profile[x] = base + broad * amplitude + detail * amplitude * 0.16;
  }
  return { profile, parallax, dayColor, nightColor };
}

function buildSkyDecor() {
  stars.length = 0;
  clouds.length = 0;
  mountainLayers.length = 0;

  for (let i = 0; i < 110; i++) {
    stars.push({ u: Math.random(), v: Math.random() * 0.58, size: Math.random() > 0.87 ? 2 : 1, twinkle: Math.random() * TAU });
  }
  for (let i = 0; i < 14; i++) {
    clouds.push({ x: Math.random() * WORLD_PX, y: 26 + Math.random() * 160, w: 68 + Math.random() * 90, h: 20 + Math.random() * 30, speed: 0.3 + Math.random() * 0.7 });
  }

  mountainLayers.push(buildMountainLayer(0.48, 0.13, 74, 180, 0.18, '#7da0bd', '#273147'));
  mountainLayers.push(buildMountainLayer(0.56, 0.16, 50, 520, 0.28, '#627c98', '#20293d'));
  mountainLayers.push(buildMountainLayer(0.66, 0.14, 32, 870, 0.42, '#44596d', '#172031'));
}

function createWallTexture(base, dark, light, seed) {
  const { texture, g } = makeCanvas();
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, seed);
      if (n > 0.86) pixel(g, x, y, light);
      else if (n < 0.16) pixel(g, x, y, dark);
    }
  }
  return texture;
}

function createGrassTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#8d5b25';
  g.fillRect(0, 0, TILE, TILE);

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 11);
      if (n > 0.84) pixel(g, x, y, '#a86d31');
      else if (n < 0.14) pixel(g, x, y, '#6e4319');
    }
  }

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < TILE; x++) {
      const light = y < 2 ? '#7dd650' : '#5fae35';
      pixel(g, x, y, hash2(x, y, 12) > 0.84 ? '#9cec71' : light);
    }
  }
  for (let x = 0; x < TILE; x += 2) pixel(g, x, 4, '#437b25');
  for (let x = 1; x < TILE; x += 4) pixel(g, x, 0, '#b0f77d');

  return texture;
}

function createDirtTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#85521f';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 20);
      if (n > 0.86) pixel(g, x, y, '#a46b32');
      else if (n < 0.16) pixel(g, x, y, '#653c15');
      else if (n > 0.62 && hash2(x, y, 21) > 0.74) pixel(g, x, y, '#745425');
    }
  }
  return texture;
}

function createStoneTexture(base, light, dark, seed) {
  const { texture, g } = makeCanvas();
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, seed);
      if (n > 0.86) pixel(g, x, y, light);
      else if (n < 0.14) pixel(g, x, y, dark);
      else if (n > 0.46 && n < 0.52) pixel(g, x, y, shiftColor(base, -0.03));
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(hash(seed + i * 7) * 12);
    const y = 2 + Math.floor(hash(seed + i * 11) * 10);
    pixel(g, x, y, dark, 1, 2);
    pixel(g, x + 1, y + 1, dark);
  }
  return texture;
}

function createOreTexture(base, light, dark, nuggetA, nuggetB, seed) {
  const texture = createStoneTexture(base, light, dark, seed);
  const g = texture.getContext('2d');
  for (let y = 2; y < TILE - 2; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      const n = hash2(x, y, seed + 90);
      if (n > 0.91) {
        pixel(g, x, y, nuggetA);
        if (hash2(x, y, seed + 91) > 0.55) pixel(g, x + 1, y, nuggetB);
        if (hash2(x, y, seed + 92) > 0.6) pixel(g, x, y + 1, shiftColor(nuggetA, -0.15));
      }
    }
  }
  return texture;
}

function createWoodTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#8f622e';
  g.fillRect(0, 0, TILE, TILE);
  for (let x = 0; x < TILE; x++) {
    const stripe = x % 4 === 0 ? '#6c451f' : x % 4 === 2 ? '#aa773b' : null;
    if (stripe) pixel(g, x, 0, stripe, 1, TILE);
  }
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 70);
      if (n > 0.88) pixel(g, x, y, '#bb8748');
      else if (n < 0.12) pixel(g, x, y, '#5a3818');
    }
  }
  return texture;
}

function createSwordTexture(bladeColor, handleColor) {
  const { texture, g } = makeCanvas(32);
  // Handle (grip) — bottom-left diagonal
  g.strokeStyle = handleColor; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(7, 25); g.lineTo(12, 20); g.stroke();
  // Guard — crosspiece
  g.strokeStyle = shiftColor(bladeColor, -0.15); g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(8, 21); g.lineTo(16, 17); g.stroke();
  // Blade — thick diagonal line
  g.strokeStyle = bladeColor; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(13, 19); g.lineTo(26, 6); g.stroke();
  // Blade highlight
  g.strokeStyle = shiftColor(bladeColor, 0.3); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(14, 17); g.lineTo(26, 5); g.stroke();
  // Tip
  g.fillStyle = shiftColor(bladeColor, 0.2);
  g.beginPath(); g.arc(26, 5, 2.5, 0, Math.PI * 2); g.fill();
  // Pommel
  g.fillStyle = shiftColor(handleColor, 0.1);
  g.beginPath(); g.arc(6, 27, 3, 0, Math.PI * 2); g.fill();
  return texture;
}

function createPickaxeTexture(headColor, handleColor) {
  const { texture, g } = makeCanvas(32);
  // Handle — diagonal from bottom-right to upper center
  g.strokeStyle = handleColor; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(27, 27); g.lineTo(14, 14); g.stroke();
  // Head body — clean horizontal bar
  g.fillStyle = headColor;
  g.beginPath();
  g.moveTo(4, 6); g.lineTo(22, 6); g.lineTo(22, 12); g.lineTo(4, 12); g.closePath();
  g.fill();
  // Left pick tip (main sharp end)
  g.beginPath();
  g.moveTo(4, 6); g.lineTo(0, 9); g.lineTo(4, 12); g.closePath();
  g.fill();
  // Right back spike
  g.beginPath();
  g.moveTo(22, 6); g.lineTo(27, 7); g.lineTo(26, 11); g.lineTo(22, 12); g.closePath();
  g.fill();
  // Neck connecting head to handle
  g.beginPath();
  g.moveTo(12, 12); g.lineTo(16, 12); g.lineTo(14, 14); g.lineTo(11, 14); g.closePath();
  g.fill();
  // Highlight on top edge
  g.fillStyle = shiftColor(headColor, 0.35);
  g.fillRect(5, 7, 16, 1);
  // Shadow on bottom edge
  g.fillStyle = shiftColor(headColor, -0.2);
  g.fillRect(5, 11, 16, 1);
  return texture;
}

function createHelmetTexture(color) {
  const { texture, g } = makeCanvas();
  pixel(g, 2, 2, color, 12, 8);    // crown
  pixel(g, 1, 3, color, 14, 7);
  pixel(g, 0, 5, color, 16, 5);
  pixel(g, 3, 10, color, 10, 4);   // visor frame
  pixel(g, 2, 10, color, 2, 5);    // cheek left
  pixel(g, 12, 10, color, 2, 5);   // cheek right
  pixel(g, 3, 14, color, 10, 2);   // chin
  pixel(g, 5, 10, '#1a1a2e', 6, 4); // visor slit
  return texture;
}

function createChestplateTexture(color) {
  const { texture, g } = makeCanvas();
  pixel(g, 3, 0, color, 10, 13);   // body
  pixel(g, 0, 3, color, 4, 11);    // left arm
  pixel(g, 12, 3, color, 4, 11);   // right arm
  pixel(g, 5, 2, '#1a1a2e', 6, 4); // collar
  return texture;
}

function createLeggingsTexture(color) {
  const { texture, g } = makeCanvas();
  pixel(g, 0, 0, color, 16, 4);    // waist
  pixel(g, 0, 4, color, 6, 12);    // left leg
  pixel(g, 10, 4, color, 6, 12);   // right leg
  pixel(g, 6, 4, '#1a1a2e', 4, 6); // gap
  return texture;
}

function createBootsTexture(color) {
  const { texture, g } = makeCanvas();
  pixel(g, 1, 0, color, 6, 13);    // left boot
  pixel(g, 9, 0, color, 6, 13);    // right boot
  pixel(g, 0, 10, color, 8, 6);    // left sole
  pixel(g, 8, 10, color, 8, 6);    // right sole
  return texture;
}

function createCoalOreTexture() {
  const tex = createStoneTexture('#777981', '#989da6', '#5e616a', 33);
  const g = tex.getContext('2d');
  for (let y = 1; y < TILE - 1; y++) for (let x = 1; x < TILE - 1; x++) {
    if (hash2(x, y, 110) > 0.88) { pixel(g, x, y, '#1a1a1a'); if (hash2(x, y, 111) > 0.5) pixel(g, x + 1, y, '#333'); }
  }
  return tex;
}

function createDoorTexture(open) {
  const { texture, g } = makeCanvas();
  if (!open) {
    pixel(g, 1, 0, '#8B6030', 14, 16);
    pixel(g, 0, 0, '#5a3518', 2, 16); pixel(g, 14, 0, '#5a3518', 2, 16);
    pixel(g, 2, 7, '#5a3518', 12, 1);
    pixel(g, 2, 1, '#7a5025', 12, 5); pixel(g, 2, 9, '#7a5025', 12, 6);
    pixel(g, 11, 4, '#d4a840', 2, 2);  // handle
  } else {
    pixel(g, 0, 0, '#5a3518', 3, 16); pixel(g, 13, 0, '#5a3518', 3, 16);
    pixel(g, 0, 0, '#5a3518', 16, 2); pixel(g, 0, 14, '#5a3518', 16, 2);
  }
  return texture;
}

function createChestTexture() {
  const { texture, g } = makeCanvas();
  pixel(g, 0, 0, '#5a3518', 16, 16);
  pixel(g, 1, 1, '#8B6030', 14, 6);
  pixel(g, 1, 8, '#8B6030', 14, 7);
  pixel(g, 0, 7, '#c8a030', 16, 2);
  pixel(g, 6, 6, '#d4a840', 4, 4); pixel(g, 7, 7, '#1a1010', 2, 2);
  return texture;
}

function createFurnaceTexture(lit) {
  const { texture, g } = makeCanvas();
  tileTextures[STONE].getContext ? g.drawImage(tileTextures[STONE], 0, 0) : null;
  pixel(g, 0, 0, '#7d7f88', 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = hash2(x, y, 44); if (n > 0.84) pixel(g, x, y, '#9ea3ad'); else if (n < 0.18) pixel(g, x, y, '#5e616a');
  }
  pixel(g, 3, 7, '#1a1a1a', 10, 8);
  if (lit) { pixel(g, 4, 8, '#ff6600', 8, 6); pixel(g, 5, 9, '#ffaa00', 6, 3); pixel(g, 6, 10, '#ffee00', 4, 1); }
  pixel(g, 5, 2, '#333', 6, 3);
  return texture;
}

function createIngotTexture(color) {
  const { texture, g } = makeCanvas();
  pixel(g, 2, 5, color, 12, 6); pixel(g, 1, 6, color, 14, 4);
  pixel(g, 3, 4, shiftColor(color, 0.2), 10, 2);
  pixel(g, 2, 11, shiftColor(color, -0.2), 12, 2);
  return texture;
}

function createAxeTexture(headColor, handleColor) {
  const { texture, g } = makeCanvas(32);
  // Handle — diagonal from bottom-right to upper-left
  g.strokeStyle = handleColor; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(27, 27); g.lineTo(13, 13); g.stroke();
  // Axe blade — large fan shape at upper-left
  g.fillStyle = headColor;
  g.beginPath();
  g.moveTo(13, 13); // handle socket top
  g.lineTo(5, 4);   // blade top
  g.lineTo(1, 11);  // cutting edge tip
  g.lineTo(5, 21);  // blade bottom
  g.lineTo(14, 17); // handle socket bottom
  g.closePath();
  g.fill();
  // Handle eye socket (where shaft meets head)
  g.fillStyle = handleColor;
  g.beginPath();
  g.moveTo(11, 12); g.lineTo(14, 10); g.lineTo(16, 13); g.lineTo(13, 16); g.closePath();
  g.fill();
  // Cutting edge highlight (curved bright edge)
  g.strokeStyle = shiftColor(headColor, 0.4); g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(5, 4); g.quadraticCurveTo(-1, 12, 5, 21); g.stroke();
  // Face highlight
  g.fillStyle = shiftColor(headColor, 0.25);
  g.beginPath();
  g.moveTo(6, 5); g.lineTo(3, 12); g.lineTo(6, 20); g.lineTo(8, 19); g.lineTo(5, 12); g.lineTo(7, 6); g.closePath();
  g.fill();
  return texture;
}

function createShovelTexture(headColor, handleColor) {
  const { texture, g } = makeCanvas(32);
  // Handle
  g.strokeStyle = handleColor; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(28, 4); g.lineTo(16, 16); g.stroke();
  // Shovel head
  g.fillStyle = headColor;
  g.beginPath();
  g.moveTo(10, 16); g.lineTo(6, 20); g.lineTo(8, 26); g.lineTo(20, 26); g.lineTo(22, 20); g.lineTo(18, 16); g.closePath();
  g.fill();
  // Shoulder bar
  g.fillStyle = shiftColor(headColor, -0.1);
  g.fillRect(8, 14, 12, 4);
  // Highlight
  g.fillStyle = shiftColor(headColor, 0.3);
  g.fillRect(9, 15, 10, 1.5);
  return texture;
}

function createBowTexture() {
  const { texture, g } = makeCanvas(32);
  // Bow stave (curved arc)
  g.strokeStyle = '#8B5E2A'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(6, 28); g.quadraticCurveTo(20, 16, 6, 4); g.stroke();
  // Highlight on stave
  g.strokeStyle = '#c0894a'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(7, 26); g.quadraticCurveTo(18, 16, 7, 6); g.stroke();
  // Bowstring
  g.strokeStyle = '#d4c090'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(6, 4); g.lineTo(6, 28); g.stroke();
  // Nock points
  g.fillStyle = '#c8a060';
  g.beginPath(); g.arc(6, 4, 2.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(6, 28, 2.5, 0, Math.PI * 2); g.fill();
  return texture;
}

function createArrowTexture() {
  const { texture, g } = makeCanvas(32);
  // Shaft
  g.strokeStyle = '#8B5E2A'; g.lineWidth = 2.5; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(4, 16); g.lineTo(24, 16); g.stroke();
  // Arrowhead
  g.fillStyle = '#c0c4cc';
  g.beginPath(); g.moveTo(24, 16); g.lineTo(30, 13); g.lineTo(30, 19); g.closePath(); g.fill();
  g.strokeStyle = '#e0e4ec'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(24, 16); g.lineTo(30, 13); g.stroke();
  // Fletching (feathers)
  g.fillStyle = '#cc4444';
  g.beginPath(); g.moveTo(4, 16); g.lineTo(2, 11); g.lineTo(8, 14); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(4, 16); g.lineTo(2, 21); g.lineTo(8, 18); g.closePath(); g.fill();
  g.fillStyle = '#ff7766';
  g.beginPath(); g.moveTo(4, 16); g.lineTo(2, 13); g.lineTo(6, 15); g.closePath(); g.fill();
  return texture;
}

function createCoalTexture() {
  const { texture, g } = makeCanvas();
  pixel(g, 3, 2, '#1a1a1a', 10, 12); pixel(g, 2, 4, '#1a1a1a', 12, 8); pixel(g, 4, 1, '#222', 8, 2);
  pixel(g, 5, 4, '#333', 6, 6);
  return texture;
}

function createAccessoryTexture(bgColor, symbol, symbolColor = '#fff') {
  const { texture, g } = makeCanvas();
  g.fillStyle = bgColor;
  g.fillRect(2, 2, 28, 28);
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1;
  g.strokeRect(2.5, 2.5, 27, 27);
  g.fillStyle = symbolColor;
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(symbol, 16, 16);
  return texture;
}

function createGoldOreTexture() {
  return createOreTexture('#777981', '#989da6', '#5d6068', '#e8c43a', '#f5dc6e', 70);
}
function createDiamondOreTexture() {
  return createOreTexture('#55525f', '#6d6b78', '#393744', '#7adcf5', '#b8f0ff', 80);
}

const toolsSheet = new Image();
const TOOL_SPRITES = {
  // Swords (Row 1)
  [SWORD_COPPER]: [1, 1], [SWORD_STONE]: [2, 1], [SWORD_IRON]: [3, 1], [SWORD_GOLD]: [4, 1], [SWORD_DIAMOND]: [5, 1],
  // Axes (were previously mapped to pickaxes)
  [AXE_COPPER]: [7, 1], [AXE_STONE]: [8, 1], [AXE_IRON]: [9, 1], [AXE_GOLD]: [7, 4], [AXE_DIAMOND]: [8, 4],
  // Pickaxes (were previously mapped to axes)
  [PICK_COPPER]: [7, 2], [PICK_STONE]: [8, 2], [PICK_IRON]: [9, 2], [PICK_GOLD]: [7, 5], [PICK_DIAMOND]: [8, 5],
  // Shovels
  [SHOVEL_COPPER]: [7, 3], [SHOVEL_STONE]: [8, 3], [SHOVEL_IRON]: [9, 3], [SHOVEL_GOLD]: [7, 6], [SHOVEL_DIAMOND]: [8, 6],
  // Bow and Arrow
  [BOW]: [0, 5], [ARROW]: [0, 6],
};

function applyToolTextures() {
  if (!toolsSheet.complete || toolsSheet.naturalWidth === 0) return;
  // Get the exact background color from the top left corner of the spritesheet (which is empty margin)
  const tempC = document.createElement('canvas');
  tempC.width = 1; tempC.height = 1;
  const tempG = tempC.getContext('2d');
  tempG.drawImage(toolsSheet, 0, 0, 1, 1, 0, 0, 1, 1);
  const bgPixel = tempG.getImageData(0, 0, 1, 1).data;
  const bgR = bgPixel[0], bgG = bgPixel[1], bgB = bgPixel[2];

  const applyTool = (type, isTool = false) => {
    const pos = TOOL_SPRITES[type];
    if (pos) tileTextures[type] = extractToolSprite(pos[0], pos[1], bgR, bgG, bgB, isTool);
  };

  // Weapons are in top-right of the 16x16 grid cell
  applyTool(SWORD_STONE); applyTool(SWORD_IRON); applyTool(SWORD_COPPER); applyTool(SWORD_GOLD); applyTool(SWORD_DIAMOND);
  applyTool(BOW); applyTool(ARROW);

  // Pickaxes, Axes, Shovels are in the top-left of the 16x16 grid cell
  applyTool(PICK_STONE, true); applyTool(PICK_IRON, true); applyTool(PICK_COPPER, true); applyTool(PICK_GOLD, true); applyTool(PICK_DIAMOND, true);
  applyTool(AXE_STONE, true); applyTool(AXE_IRON, true); applyTool(AXE_COPPER, true); applyTool(AXE_GOLD, true); applyTool(AXE_DIAMOND, true);
  applyTool(SHOVEL_STONE, true); applyTool(SHOVEL_IRON, true); applyTool(SHOVEL_COPPER, true); applyTool(SHOVEL_GOLD, true); applyTool(SHOVEL_DIAMOND, true);
}

toolsSheet.onload = () => {
  applyToolTextures();
};
toolsSheet.src = 'images/mineria/tools-and-weapons/Toolsall.png';

function extractToolSprite(col, row, bgR, bgG, bgB, isTool) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;

  if (toolsSheet.complete && toolsSheet.naturalWidth > 0) {
    // Weapons: top-right corner (+8 x offset). Tools: top-left corner (+0 x offset)
    const offsetX = isTool ? 0 : 8;
    g.drawImage(toolsSheet, col * 16 + offsetX, row * 16, 8, 8, 0, 0, 16, 16);

    // Clear out the dark background from the sprite
    const imgData = g.getImageData(0, 0, 16, 16);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], gVal = data[i + 1], b = data[i + 2], a = data[i + 3];
      // Only clear if color is very close to the assumed background
      if (a > 0 && Math.abs(r - bgR) < 10 && Math.abs(gVal - bgG) < 10 && Math.abs(b - bgB) < 10) {
        data[i + 3] = 0; // Set to fully transparent
      }
    }
    g.putImageData(imgData, 0, 0);
  }
  return c;
}

// Rebuild textures when the spritesheet actually loads (already set up above)
function buildTextures() {
  tileTextures[GRASS] = createGrassTexture();
  tileTextures[DIRT] = createDirtTexture();
  tileTextures[STONE] = createStoneTexture('#7d7f88', '#9ea3ad', '#5e616a', 30);
  tileTextures[DSTONE] = createStoneTexture('#55525f', '#6d6b78', '#393744', 40);
  tileTextures[COPPER] = createOreTexture('#777981', '#989da6', '#5d6068', '#d28b4b', '#e9ac68', 50);
  tileTextures[IRON] = createOreTexture('#696d77', '#8b929e', '#484d56', '#c0c4cc', '#eff3f9', 60);
  tileTextures[WOOD] = createWoodTexture();
  tileTextures[TREE] = tileTextures[WOOD];
  wallTextures.shallow = createWallTexture('#59402e', '#402c1f', '#6a4e3a', 81);
  wallTextures.deep = createWallTexture('#342822', '#211813', '#473732', 82);

  // Apply placeholders or immediate loaded textures
  applyToolTextures();

  tileTextures[HELMET] = createHelmetTexture('#d28b4b');
  tileTextures[CHESTPLATE] = createChestplateTexture('#d28b4b');
  tileTextures[LEGGINGS] = createLeggingsTexture('#d28b4b');
  tileTextures[BOOTS] = createBootsTexture('#d28b4b');
  tileTextures[COAL_ORE] = createCoalOreTexture();
  tileTextures[DOOR] = createDoorTexture(false);
  tileTextures[DOOR_OPEN] = createDoorTexture(true);
  tileTextures[CHEST] = createChestTexture();
  tileTextures[FURNACE] = createFurnaceTexture(false);
  tileTextures[COPPER_INGOT] = createIngotTexture('#d28b4b');
  tileTextures[IRON_INGOT] = createIngotTexture('#c0c4cc');
  tileTextures[COAL] = createCoalTexture();
  // New ore textures
  tileTextures[GOLD_ORE] = createGoldOreTexture();
  tileTextures[DIAMOND] = createDiamondOreTexture();
  tileTextures[GOLD_INGOT] = createIngotTexture('#e8c43a');
  // Iron armor
  tileTextures[HELMET_IRON] = createHelmetTexture('#c0c4cc');
  tileTextures[CHESTPLATE_IRON] = createChestplateTexture('#c0c4cc');
  tileTextures[LEGGINGS_IRON] = createLeggingsTexture('#c0c4cc');
  tileTextures[BOOTS_IRON] = createBootsTexture('#c0c4cc');
  // Gold armor
  tileTextures[HELMET_GOLD] = createHelmetTexture('#e8c43a');
  tileTextures[CHESTPLATE_GOLD] = createChestplateTexture('#e8c43a');
  tileTextures[LEGGINGS_GOLD] = createLeggingsTexture('#e8c43a');
  tileTextures[BOOTS_GOLD] = createBootsTexture('#e8c43a');
  // Accessories
  tileTextures[ACC_HERMES_BOOTS] = createAccessoryTexture('#3a8aff', '👟', '#fff');
  tileTextures[ACC_CLOUD_BOTTLE] = createAccessoryTexture('#88ccff', '☁', '#fff');
  tileTextures[ACC_HORSESHOE] = createAccessoryTexture('#e8c43a', '🍀', '#228b22');
  tileTextures[ACC_BAND_REGEN] = createAccessoryTexture('#cc3344', '❤', '#ff8888');
  tileTextures[ACC_FROG_LEG] = createAccessoryTexture('#44aa44', '🐸', '#88ff88');
  tileTextures[ACC_SHACKLE] = createAccessoryTexture('#666677', '⛓', '#aaa');
  tileTextures[ACC_ANKH] = createAccessoryTexture('#cc8833', '☥', '#ffe080');
  tileTextures[ACC_NECKLACE] = createAccessoryTexture('#cc44cc', '💎', '#ffaaff');
  tileTextures[ACC_AGLET] = createAccessoryTexture('#558844', '>', '#aaff88');
  tileTextures[ACC_SPECTRE_BOOTS] = createAccessoryTexture('#8844ff', '⚡', '#ccaaff');
  // Diamond armor
  tileTextures[HELMET_DIAMOND] = createHelmetTexture('#7adcf5');
  tileTextures[CHESTPLATE_DIAMOND] = createChestplateTexture('#7adcf5');
  tileTextures[LEGGINGS_DIAMOND] = createLeggingsTexture('#7adcf5');
  tileTextures[BOOTS_DIAMOND] = createBootsTexture('#7adcf5');
}

const ALL_ACCESSORIES = [
  ACC_HERMES_BOOTS, ACC_CLOUD_BOTTLE, ACC_HORSESHOE, ACC_BAND_REGEN,
  ACC_FROG_LEG, ACC_SHACKLE, ACC_ANKH, ACC_NECKLACE, ACC_AGLET, ACC_SPECTRE_BOOTS,
];

function spawnCaveChests() {
  const count = 8 + Math.floor(Math.random() * 5);
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < count; attempt++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const minDepth = surfaceYs[x] + 12;
    // Scan downward from minDepth to find an air cell above a solid floor
    for (let y = minDepth; y < WORLD_H - 2; y++) {
      if (getBlock(x, y) === AIR && isSolid(getBlock(x, y + 1))) {
        setBlock(x, y, CHEST);
        const key = blockKey(x, y);
        const slots = Array.from({ length: CHEST_SLOTS }, () => createStack());
        // 1–3 random accessories + some coins/materials
        const numAcc = 1 + Math.floor(Math.random() * 2);
        const shuffled = ALL_ACCESSORIES.slice().sort(() => Math.random() - 0.5);
        for (let a = 0; a < numAcc; a++) slots[a] = createStack(shuffled[a], 1);
        // Filler: coins or basic materials in later slots
        const fillers = [COAL, COPPER_INGOT, ARROW, IRON_INGOT];
        for (let f = numAcc; f < numAcc + 3; f++) {
          const mat = fillers[Math.floor(Math.random() * fillers.length)];
          slots[f] = createStack(mat, 5 + Math.floor(Math.random() * 20));
        }
        chests.set(key, slots);
        placed++;
        break;
      }
    }
  }
}

function generateWorld() {
  world.fill(0);
  water.fill(0);
  chests.clear();
  generateBiomeBands();

  for (let x = 0; x < WORLD_W; x++) {
    const surface = groundHeightAt(x);
    const dirtDepth = biomes[x] === BIOME_ROCKY ? 3 : 5 + Math.floor(hash(x * 13) * 3);
    surfaceYs[x] = surface;
    for (let y = 0; y < WORLD_H; y++) {
      if (y < surface) setBlock(x, y, AIR);
      else if (y === surface) setBlock(x, y, GRASS);
      else if (y < surface + dirtDepth) setBlock(x, y, DIRT);
      else if (y < surface + 60) setBlock(x, y, STONE);
      else setBlock(x, y, DSTONE);
    }
  }

  for (let i = 0; i < 7; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    digAirWorm(x, surfaceYs[x], 50 + Math.floor(Math.random() * 35), 0.9 + Math.random() * 0.7, Math.PI / 2 + (Math.random() - 0.5) * 0.55, 0);
  }
  for (let i = 0; i < 17; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    const y = surfaceYs[x] + 12 + Math.floor(Math.random() * 55);
    digAirWorm(x, y, 75 + Math.floor(Math.random() * 60), 1.1 + Math.random() * 0.9, Math.random() * TAU, 5);
  }
  for (let i = 0; i < 7; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    const y = surfaceYs[x] + 58 + Math.floor(Math.random() * 28);
    digAirWorm(x, y, 65 + Math.floor(Math.random() * 45), 1.8 + Math.random() * 1.1, Math.random() * TAU, 8);
  }

  spawnOres();
  spawnWaterPools();
  settleWater(120);
  plantTrees();
  spawnCaveChests();
}

function findSpawnY() {
  const center = Math.floor(WORLD_W / 2);
  for (let y = 0; y < WORLD_H; y++) {
    const type = getBlock(center, y);
    if (isSolid(type)) return y * TILE - 44;
  }
  return 10 * TILE;
}

resize();
window.addEventListener('resize', resize);
generateWorld();
buildSkyDecor();
buildTextures();

const player = {
  x: WORLD_PX / 2 - 16,
  y: findSpawnY(),
  w: 22,
  h: 44,
  vy: 0,
  onGround: false,
  blockedX: false,
  facing: 1,
  animState: 'stand',
  animFrame: 0,
  animTick: 0,
  air: PLAYER_MAX_AIR,
  maxAir: PLAYER_MAX_AIR,
  inWater: false,
  fullySubmerged: false,
  drownTick: 0,
  jumpLatch: false,
  jumpAnimRestart: false,
  waterExitFrames: 0,
  health: 5,
  maxHealth: 5,
  iframes: 0,
  dying: false,
  deathFrame: 0,
  deathTick: 0,
};

cam.x = WORLD_PX / 2 - canvas.width / 2;
cam.y = 48 * TILE - canvas.height / 2;

const GRAVITY = 0.52;
const MAX_FALL = TILE - 1;
const JUMP_VEL = -11.4;
const WATER_EXIT_JUMP_VEL = JUMP_VEL * Math.SQRT1_2;
const WALK_SPEED = 2.45;
const RUN_SPEED = 4.85;

const spritesheet = new Image();
spritesheet.src = 'images/mineria/platformer_sprites_pixelized_0.png';

const FRAME_SIZE = 64;
const SHEET_COLS = 8;

// Offscreen canvas used to tint the player sprite without bleeding into the background
const hitCanvas = document.createElement('canvas');
hitCanvas.width = FRAME_SIZE;
hitCanvas.height = FRAME_SIZE;
const hitCtx = hitCanvas.getContext('2d');
hitCtx.imageSmoothingEnabled = false;

const ANIM = {
  stand: { row: 8, colStart: 0 },
  walk: { row: 4, colStart: 0 },
  run: null,
  jump: { row: 5, colStart: 2 },
  mine: { row: 1, colStart: 4 },
  attack: { row: 1, colStart: 4 },  // same frames as mine (swing)
  bow: { row: 3, colStart: 5 },  // frames 29-32: row3 cols5-7, then row4 col0
};

// Frames 19–23 (0-indexed); last frame (row 2, col 7) is the body-drop hold frame
const DEATH_FRAMES = [
  { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
  { row: 2, col: 6 }, { row: 2, col: 7 },
];
const DEATH_TICKS_PER_FRAME = 7;

function collidesWithWorld(px, py, pw, ph) {
  const left = Math.floor(px / TILE);
  const right = Math.floor((px + pw - 1) / TILE);
  const top = Math.floor(py / TILE);
  const bottom = Math.floor((py + ph - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(getBlock(tx, ty))) return true;
    }
  }
  return false;
}

function checkOnGround(px, py, pw, ph) {
  const feetTile = Math.floor((py + ph) / TILE);
  const left = Math.floor(px / TILE);
  const right = Math.floor((px + pw - 1) / TILE);
  for (let tx = left; tx <= right; tx++) {
    if (isSolid(getBlock(tx, feetTile))) return true;
  }
  return false;
}

function simulateWaterStep() {
  waterFlowParity ^= 1;

  for (let y = WORLD_H - 1; y >= 0; y--) {
    const leftToRight = ((y + waterFlowParity) & 1) === 0;
    const startX = leftToRight ? 0 : WORLD_W - 1;
    const endX = leftToRight ? WORLD_W : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const idx = waterIndex(x, y);
      if (isSolid(getBlock(x, y))) {
        water[idx] = 0;
        continue;
      }

      let amount = water[idx];
      if (amount <= WATER_MOVE_THRESHOLD) {
        if (amount > 0) water[idx] = 0;
        continue;
      }

      if (canWaterOccupy(x, y + 1)) {
        const belowIdx = waterIndex(x, y + 1);
        const capacity = WATER_MAX - water[belowIdx];
        if (capacity > WATER_MOVE_THRESHOLD) {
          const flow = Math.min(amount, capacity);
          water[idx] -= flow;
          water[belowIdx] += flow;
          amount -= flow;
        }
      }

      if (amount <= WATER_MOVE_THRESHOLD) {
        water[idx] = 0;
        continue;
      }

      const belowSupported = !canWaterOccupy(x, y + 1) || getWater(x, y + 1) >= WATER_MAX - WATER_MOVE_THRESHOLD;
      if (!belowSupported) continue;

      const dirs = ((x + y + waterFlowParity) & 1) === 0 ? [-1, 1] : [1, -1];
      for (const dir of dirs) {
        const nx = x + dir;
        if (!canWaterOccupy(nx, y)) continue;

        const neighborIdx = waterIndex(nx, y);
        const neighborAmount = water[neighborIdx];
        const desired = (amount + neighborAmount) * 0.5;
        let flow = amount - desired;
        if (flow <= WATER_MOVE_THRESHOLD) continue;

        flow = Math.min(flow, WATER_SIDE_FLOW, amount);
        water[idx] -= flow;
        water[neighborIdx] += flow;
        amount -= flow;

        if (amount <= WATER_MOVE_THRESHOLD) break;
      }

      if (water[idx] <= WATER_MOVE_THRESHOLD) water[idx] = 0;
    }
  }
}

function settleWater(iterations) {
  for (let i = 0; i < iterations; i++) simulateWaterStep();
}

function isPointInWater(px, py) {
  const tileX = Math.floor(px / TILE);
  const tileY = Math.floor(py / TILE);
  const amount = getWater(tileX, tileY);
  if (amount <= WATER_RENDER_EPS) return false;
  const fillTop = tileY * TILE + TILE * (1 - clamp(amount, 0, WATER_MAX));
  return py >= fillTop;
}

function sampleWaterCoverage(px, py, pw, ph) {
  const sampleXs = [px + 3, px + pw * 0.5, px + pw - 3];
  const sampleYs = [py + 4, py + ph * 0.45, py + ph - 4];
  let wet = 0;
  let total = 0;

  for (const sampleY of sampleYs) {
    for (const sampleX of sampleXs) {
      total++;
      if (isPointInWater(sampleX, sampleY)) wet++;
    }
  }

  return total > 0 ? wet / total : 0;
}

const keys = {};
window.addEventListener('keydown', event => {
  if (!event.repeat && audioManager) audioManager.unlock();
  if (event.code === 'Escape') {
    event.preventDefault();
    if (!event.repeat) handleEscape();
    return;
  }
  if (event.code === 'Tab') {
    event.preventDefault();
    if (!event.repeat && gameState === 'playing') { openUI = null; toggleInventory(); }
    return;
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    if (!event.repeat && gameState === 'playing') {
      if (openUI) {
        const wasOpen = openUI.wasInventoryOpen ?? true;
        openUI = null;
        if (!wasOpen) toggleInventory(false);
      } else {
        handleWorldRightClick();
      }
    }
    return;
  }
  if (gameState !== 'playing') return;
  keys[event.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener('keyup', event => {
  keys[event.code] = false;
});

const mouse = { x: 0, y: 0, down: false, rightDown: false, shift: false, ctrl: false };
function syncMouseFromEvent(event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.shift = event.shiftKey;
  mouse.ctrl = event.ctrlKey;
}

const HOTBAR_SIZE = 8;
const BACKPACK_COLS = 8;
const BACKPACK_ROWS = 3;
const BACKPACK_SIZE = BACKPACK_COLS * BACKPACK_ROWS;
const STACK_LIMIT = 999;

function createStack(type = AIR, count = 0) {
  return { type, count };
}

function isEmptyStack(stack) {
  return !stack || stack.type === AIR || stack.count <= 0;
}

function setStack(slot, stack) {
  if (!slot) return;
  slot.type = stack?.type ?? AIR;
  slot.count = stack?.count ?? 0;
  if (slot.type === AIR || slot.count <= 0) {
    slot.type = AIR;
    slot.count = 0;
  }
}

function cloneStack(stack) {
  return createStack(stack?.type ?? AIR, stack?.count ?? 0);
}

const inventory = {
  hotbar: Array.from({ length: HOTBAR_SIZE }, () => createStack()),
  backpack: Array.from({ length: BACKPACK_SIZE }, () => createStack()),
  selected: 0,
  open: false,
};

const dragState = {
  active: false,
  sourceArea: null,
  sourceIndex: -1,
  item: createStack(),
};

inventory.hotbar[0] = createStack(PICK_COPPER, 1);
inventory.hotbar[1] = createStack(SWORD_COPPER, 1);
inventory.hotbar[2] = createStack(AXE_COPPER, 1);

// ─── CRAFTING & EQUIPMENT ─────────────────────────────────────────────────────

const CRAFT_SIZE = 9; // 3×3 grid
const craftingGrid = Array.from({ length: CRAFT_SIZE }, () => createStack());
let craftingOutput = createStack();

const equipment = Array.from({ length: 4 }, () => createStack());
const EQUIP_LABELS = ['Head', 'Chest', 'Legs', 'Feet'];
// accessories is declared earlier in the file (after armorDefs)

const RECIPES = [
  // Pickaxes: 3 material in top row, wood handle in middle+bottom center
  { pattern: [COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, AIR, WOOD, AIR, AIR, WOOD, AIR], out: PICK_COPPER, count: 1 },
  { pattern: [STONE, STONE, STONE, AIR, WOOD, AIR, AIR, WOOD, AIR], out: PICK_STONE, count: 1 },
  { pattern: [IRON_INGOT, IRON_INGOT, IRON_INGOT, AIR, WOOD, AIR, AIR, WOOD, AIR], out: PICK_IRON, count: 1 },
  // Swords: 2 material in center column, wood handle at bottom
  { pattern: [AIR, COPPER_INGOT, AIR, AIR, COPPER_INGOT, AIR, AIR, WOOD, AIR], out: SWORD_COPPER, count: 1 },
  { pattern: [AIR, STONE, AIR, AIR, STONE, AIR, AIR, WOOD, AIR], out: SWORD_STONE, count: 1 },
  { pattern: [AIR, IRON_INGOT, AIR, AIR, IRON_INGOT, AIR, AIR, WOOD, AIR], out: SWORD_IRON, count: 1 },
  // Axes: 2 material in L-shape top-left, wood handle
  { pattern: [COPPER_INGOT, COPPER_INGOT, AIR, COPPER_INGOT, WOOD, AIR, AIR, WOOD, AIR], out: AXE_COPPER, count: 1 },
  { pattern: [STONE, STONE, AIR, STONE, WOOD, AIR, AIR, WOOD, AIR], out: AXE_STONE, count: 1 },
  { pattern: [IRON_INGOT, IRON_INGOT, AIR, IRON_INGOT, WOOD, AIR, AIR, WOOD, AIR], out: AXE_IRON, count: 1 },
  // Shovels: 1 material on top center, wood handle below
  { pattern: [AIR, COPPER_INGOT, AIR, AIR, WOOD, AIR, AIR, WOOD, AIR], out: SHOVEL_COPPER, count: 1 },
  { pattern: [AIR, STONE, AIR, AIR, WOOD, AIR, AIR, WOOD, AIR], out: SHOVEL_STONE, count: 1 },
  { pattern: [AIR, IRON_INGOT, AIR, AIR, WOOD, AIR, AIR, WOOD, AIR], out: SHOVEL_IRON, count: 1 },
  // Bow: 3 wood in column with arrow shape
  { pattern: [AIR, WOOD, AIR, AIR, AIR, WOOD, AIR, WOOD, AIR], out: BOW, count: 1 },
  // Arrows: stone + wood = 4 arrows
  { pattern: [AIR, STONE, AIR, AIR, WOOD, AIR, AIR, AIR, AIR], out: ARROW, count: 4 },
  // Copper armor (uses copper ingots now)
  { pattern: [COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, AIR, COPPER_INGOT, AIR, AIR, AIR], out: HELMET, count: 1 },
  { pattern: [COPPER_INGOT, AIR, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT], out: CHESTPLATE, count: 1 },
  { pattern: [COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, AIR, COPPER_INGOT, COPPER_INGOT, AIR, COPPER_INGOT], out: LEGGINGS, count: 1 },
  { pattern: [AIR, AIR, AIR, COPPER_INGOT, AIR, COPPER_INGOT, COPPER_INGOT, AIR, COPPER_INGOT], out: BOOTS, count: 1 },
  // Gold tools (use GOLD_INGOT)
  { pattern: [GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, AIR, WOOD, AIR, AIR, WOOD, AIR], out: PICK_GOLD, count: 1 },
  { pattern: [AIR, GOLD_INGOT, AIR, AIR, GOLD_INGOT, AIR, AIR, WOOD, AIR], out: SWORD_GOLD, count: 1 },
  { pattern: [GOLD_INGOT, GOLD_INGOT, AIR, GOLD_INGOT, WOOD, AIR, AIR, WOOD, AIR], out: AXE_GOLD, count: 1 },
  { pattern: [AIR, GOLD_INGOT, AIR, AIR, WOOD, AIR, AIR, WOOD, AIR], out: SHOVEL_GOLD, count: 1 },
  // Diamond tools (use DIAMOND raw)
  { pattern: [DIAMOND, DIAMOND, DIAMOND, AIR, WOOD, AIR, AIR, WOOD, AIR], out: PICK_DIAMOND, count: 1 },
  { pattern: [AIR, DIAMOND, AIR, AIR, DIAMOND, AIR, AIR, WOOD, AIR], out: SWORD_DIAMOND, count: 1 },
  { pattern: [DIAMOND, DIAMOND, AIR, DIAMOND, WOOD, AIR, AIR, WOOD, AIR], out: AXE_DIAMOND, count: 1 },
  { pattern: [AIR, DIAMOND, AIR, AIR, WOOD, AIR, AIR, WOOD, AIR], out: SHOVEL_DIAMOND, count: 1 },
  // Iron armor
  { pattern: [IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT, AIR, IRON_INGOT, AIR, AIR, AIR], out: HELMET_IRON, count: 1 },
  { pattern: [IRON_INGOT, AIR, IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT], out: CHESTPLATE_IRON, count: 1 },
  { pattern: [IRON_INGOT, IRON_INGOT, IRON_INGOT, IRON_INGOT, AIR, IRON_INGOT, IRON_INGOT, AIR, IRON_INGOT], out: LEGGINGS_IRON, count: 1 },
  { pattern: [AIR, AIR, AIR, IRON_INGOT, AIR, IRON_INGOT, IRON_INGOT, AIR, IRON_INGOT], out: BOOTS_IRON, count: 1 },
  // Gold armor
  { pattern: [GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, AIR, GOLD_INGOT, AIR, AIR, AIR], out: HELMET_GOLD, count: 1 },
  { pattern: [GOLD_INGOT, AIR, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT], out: CHESTPLATE_GOLD, count: 1 },
  { pattern: [GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, GOLD_INGOT, AIR, GOLD_INGOT, GOLD_INGOT, AIR, GOLD_INGOT], out: LEGGINGS_GOLD, count: 1 },
  { pattern: [AIR, AIR, AIR, GOLD_INGOT, AIR, GOLD_INGOT, GOLD_INGOT, AIR, GOLD_INGOT], out: BOOTS_GOLD, count: 1 },
  // Diamond armor
  { pattern: [DIAMOND, DIAMOND, DIAMOND, DIAMOND, AIR, DIAMOND, AIR, AIR, AIR], out: HELMET_DIAMOND, count: 1 },
  { pattern: [DIAMOND, AIR, DIAMOND, DIAMOND, DIAMOND, DIAMOND, DIAMOND, DIAMOND, DIAMOND], out: CHESTPLATE_DIAMOND, count: 1 },
  { pattern: [DIAMOND, DIAMOND, DIAMOND, DIAMOND, AIR, DIAMOND, DIAMOND, AIR, DIAMOND], out: LEGGINGS_DIAMOND, count: 1 },
  { pattern: [AIR, AIR, AIR, DIAMOND, AIR, DIAMOND, DIAMOND, AIR, DIAMOND], out: BOOTS_DIAMOND, count: 1 },
  // Furnace: 8 stone surrounding center
  { pattern: [STONE, STONE, STONE, STONE, AIR, STONE, STONE, STONE, STONE], out: FURNACE, count: 1 },
  // Chest: 8 wood surrounding center
  { pattern: [WOOD, WOOD, WOOD, WOOD, AIR, WOOD, WOOD, WOOD, WOOD], out: CHEST, count: 1 },
  // Door: 6 wood, 2 columns of 3
  { pattern: [WOOD, WOOD, AIR, WOOD, WOOD, AIR, WOOD, WOOD, AIR], out: DOOR, count: 1 },
];

function updateCraftingOutput() {
  craftingOutput = createStack();
  for (const recipe of RECIPES) {
    if (recipe.pattern.every((req, i) => {
      const have = isEmptyStack(craftingGrid[i]) ? AIR : craftingGrid[i].type;
      return have === req;
    })) {
      craftingOutput = createStack(recipe.out, recipe.count);
      return;
    }
  }
}

function consumeCraftingIngredients() {
  for (let i = 0; i < CRAFT_SIZE; i++) {
    if (!isEmptyStack(craftingGrid[i])) {
      craftingGrid[i].count--;
      if (craftingGrid[i].count <= 0) setStack(craftingGrid[i], createStack());
    }
  }
  updateCraftingOutput();
}

function takeCraftingOutput() {
  if (isEmptyStack(craftingOutput)) return;
  if (addToInventory(craftingOutput.type, craftingOutput.count)) {
    consumeCraftingIngredients();
  }
}

function returnCraftingGridToInventory() {
  for (let i = 0; i < CRAFT_SIZE; i++) {
    if (!isEmptyStack(craftingGrid[i])) {
      addToInventory(craftingGrid[i].type, craftingGrid[i].count);
      setStack(craftingGrid[i], createStack());
    }
  }
  craftingOutput = createStack();
}

function getInventoryArray(area) {
  if (area === 'hotbar') return inventory.hotbar;
  if (area === 'backpack') return inventory.backpack;
  if (area === 'craft') return craftingGrid;
  if (area === 'equip') return equipment;
  if (area === 'acc') return accessories;
  if (area === 'chest' && openUI?.type === 'chest') return chests.get(openUI.key) ?? null;
  return null;
}

function getInventorySlot(area, index) {
  if (area === 'furnaceOre' && openUI?.type === 'furnace') return furnaces.get(openUI.key)?.ore ?? null;
  if (area === 'furnaceFuel' && openUI?.type === 'furnace') return furnaces.get(openUI.key)?.fuel ?? null;
  if (area === 'furnaceOut' && openUI?.type === 'furnace') return furnaces.get(openUI.key)?.out ?? null;
  const slots = getInventoryArray(area);
  return slots && index >= 0 && index < slots.length ? slots[index] : null;
}

function getInventorySlotGroups() {
  return [inventory.hotbar, inventory.backpack];
}

function isSingleItemArea(area) {
  return area === 'equip' || area === 'acc';
}

function canAcceptStackInArea(area, index, stack) {
  if (!stack || isEmptyStack(stack)) return false;
  if (area === 'craftout' || area === 'furnaceOut') return false;
  if (area === 'equip') {
    const def = itemDefs[stack.type];
    return !!def && def.equipSlot === index;
  }
  if (area === 'acc') {
    const def = itemDefs[stack.type];
    return !!def?.accessory;
  }
  if (area === 'furnaceOre') return !!SMELT_RECIPES[stack.type];
  if (area === 'furnaceFuel') return stack.type === COAL;
  return !!getInventorySlot(area, index);
}

function moveTypeIntoSlots(type, amount, slots) {
  if (!Array.isArray(slots) || type === AIR || amount <= 0) return amount;
  let remaining = amount;

  for (const slot of slots) {
    if (slot.type !== type || slot.count <= 0 || slot.count >= STACK_LIMIT) continue;
    const transfer = Math.min(STACK_LIMIT - slot.count, remaining);
    slot.count += transfer;
    remaining -= transfer;
    if (remaining <= 0) return 0;
  }

  for (const slot of slots) {
    if (!isEmptyStack(slot)) continue;
    const transfer = Math.min(STACK_LIMIT, remaining);
    setStack(slot, createStack(type, transfer));
    remaining -= transfer;
    if (remaining <= 0) return 0;
  }

  return remaining;
}

function moveTypeIntoCollections(type, amount, collections) {
  let remaining = amount;
  for (const collection of collections) {
    const slots = Array.isArray(collection) ? collection : [collection];
    remaining = moveTypeIntoSlots(type, remaining, slots);
    if (remaining <= 0) break;
  }
  return remaining;
}

function finalizeShiftSource(area, srcSlot, remaining) {
  if (remaining <= 0) setStack(srcSlot, createStack());
  else srcSlot.count = remaining;
  if (area === 'craft') updateCraftingOutput();
}

function moveOneItemIntoSlot(srcSlot, targetSlot) {
  if (!targetSlot || !isEmptyStack(targetSlot) || isEmptyStack(srcSlot)) return false;
  setStack(targetSlot, createStack(srcSlot.type, 1));
  srcSlot.count--;
  if (srcSlot.count <= 0) setStack(srcSlot, createStack());
  return true;
}

function tryShiftEquipStack(srcSlot) {
  const def = itemDefs[srcSlot.type];
  if (!def) return false;
  if (def.equipSlot != null) return moveOneItemIntoSlot(srcSlot, equipment[def.equipSlot]);
  if (!def.accessory) return false;
  const target = accessories.find(slot => isEmptyStack(slot));
  return moveOneItemIntoSlot(srcSlot, target);
}

function clearDragState() {
  dragState.active = false;
  dragState.sourceArea = null;
  dragState.sourceIndex = -1;
  dragState.item = createStack();
}

function returnDraggedStack() {
  if (!dragState.active || isEmptyStack(dragState.item)) {
    clearDragState();
    return;
  }
  const wasCraft = dragState.sourceArea === 'craft';
  const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
  if (sourceSlot) setStack(sourceSlot, dragState.item);
  else addToInventory(dragState.item.type, dragState.item.count);
  clearDragState();
  if (wasCraft) updateCraftingOutput();
}

function toggleInventory(forceOpen = !inventory.open) {
  const nextOpen = !!forceOpen;
  if (inventory.open === nextOpen) return;
  if (!nextOpen) {
    if (dragState.active) returnDraggedStack();
    returnCraftingGridToInventory();
  }
  inventory.open = nextOpen;
}

function dropDraggedStack(area, index) {
  if (!dragState.active) return;

  if (!canAcceptStackInArea(area, index, dragState.item)) {
    returnDraggedStack();
    return;
  }

  const targetSlot = getInventorySlot(area, index);
  if (!targetSlot) {
    returnDraggedStack();
    return;
  }

  if (area === 'hotbar') inventory.selected = index;

  const srcArea = dragState.sourceArea;

  if (area === dragState.sourceArea && index === dragState.sourceIndex) {
    setStack(targetSlot, dragState.item);
    clearDragState();
    return;
  }

  if (isEmptyStack(targetSlot)) {
    setStack(targetSlot, dragState.item);
    clearDragState();
    if (area === 'craft' || srcArea === 'craft') updateCraftingOutput();
    return;
  }

  if (!isSingleItemArea(area) && targetSlot.type === dragState.item.type && targetSlot.count < STACK_LIMIT) {
    const transfer = Math.min(STACK_LIMIT - targetSlot.count, dragState.item.count);
    targetSlot.count += transfer;
    dragState.item.count -= transfer;
    if (dragState.item.count <= 0) {
      clearDragState();
      if (area === 'craft' || srcArea === 'craft') updateCraftingOutput();
      return;
    }
    const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
    if (sourceSlot) setStack(sourceSlot, dragState.item);
    clearDragState();
    if (area === 'craft' || srcArea === 'craft') updateCraftingOutput();
    return;
  }

  const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
  const swapped = cloneStack(targetSlot);
  setStack(targetSlot, dragState.item);
  if (sourceSlot) setStack(sourceSlot, swapped);
  clearDragState();
  if (area === 'craft' || srcArea === 'craft') updateCraftingOutput();
}

// Shift+click: instantly move entire stack between hotbar↔backpack (or craft/equip → backpack)
function shiftClickSlot(area, index) {
  const srcSlot = getInventorySlot(area, index);
  if (!srcSlot || isEmptyStack(srcSlot)) return;

  if (tryShiftEquipStack(srcSlot)) {
    if (area === 'craft') updateCraftingOutput();
    return;
  }

  let destinations = null;

  if (openUI?.type === 'chest') {
    const chestSlots = chests.get(openUI.key) ?? [];
    if (area === 'chest') destinations = [inventory.backpack, inventory.hotbar];
    else if (area === 'hotbar' || area === 'backpack') destinations = [chestSlots];
  } else if (openUI?.type === 'furnace') {
    const furnace = furnaces.get(openUI.key);
    if (area === 'furnaceOre' || area === 'furnaceFuel' || area === 'furnaceOut') {
      destinations = [inventory.backpack, inventory.hotbar];
    } else if (furnace) {
      if (SMELT_RECIPES[srcSlot.type]) destinations = [furnace.ore];
      else if (srcSlot.type === COAL) destinations = [furnace.fuel];
    }
  }

  if (!destinations) {
    if (area === 'hotbar') destinations = [inventory.backpack];
    else if (area === 'backpack') destinations = [inventory.hotbar];
    else destinations = [inventory.backpack, inventory.hotbar];
  }

  const remaining = moveTypeIntoCollections(srcSlot.type, srcSlot.count, destinations);
  finalizeShiftSource(area, srcSlot, remaining);
}

// Ctrl+click: collect all stacks of same type from hotbar+backpack into cursor
function ctrlClickSlot(area, index) {
  const srcSlot = getInventorySlot(area, index);
  if (!srcSlot || isEmptyStack(srcSlot)) return;

  const type = srcSlot.type;
  let total = 0;

  for (const slots of [inventory.hotbar, inventory.backpack]) {
    for (const slot of slots) {
      if (slot.type !== type) continue;
      total += slot.count;
      setStack(slot, createStack());
    }
  }

  // Also collect from source if it was craft/equip (those weren't in the loop above)
  if (area === 'craft' || area === 'equip') {
    total += srcSlot.count;
    setStack(srcSlot, createStack());
    if (area === 'craft') updateCraftingOutput();
  }

  if (total <= 0) return;

  dragState.active = true;
  dragState.sourceArea = null;
  dragState.sourceIndex = -1;
  dragState.item = createStack(type, Math.min(total, STACK_LIMIT));
}

function handleInventoryPrimaryDown() {
  const slotRef = getUiSlotAt(mouse.x, mouse.y);
  if (!slotRef) return;
  if (slotRef.area === 'hotbar') inventory.selected = slotRef.index;
  if (!inventory.open && !openUI) return;

  // Click craft output: take the result
  if (slotRef.area === 'craftout') {
    if (!dragState.active) takeCraftingOutput();
    return;
  }

  // Shift+click: move entire stack without dragging
  if (mouse.shift && !dragState.active) {
    shiftClickSlot(slotRef.area, slotRef.index);
    return;
  }

  // Ctrl+click: collect all of same type into cursor
  if (mouse.ctrl && !dragState.active) {
    ctrlClickSlot(slotRef.area, slotRef.index);
    return;
  }

  // If drag active: deposit on click (don't require hold)
  if (dragState.active) {
    dropDraggedStack(slotRef.area, slotRef.index);
    return;
  }

  const slot = getInventorySlot(slotRef.area, slotRef.index);
  if (isEmptyStack(slot)) return;

  dragState.active = true;
  dragState.sourceArea = slotRef.area;
  dragState.sourceIndex = slotRef.index;
  dragState.item = cloneStack(slot);
  setStack(slot, createStack());
  if (slotRef.area === 'craft') updateCraftingOutput();
}

// Right-click: pick up half-stack (no drag) or place one item (drag active)
function handleInventoryRightDown() {
  if (!inventory.open && !openUI) return;
  const slotRef = getUiSlotAt(mouse.x, mouse.y);
  if (!slotRef || slotRef.area === 'craftout') return;
  if (slotRef.area === 'furnaceOut' && dragState.active) return;

  if (dragState.active) {
    // Place one item into target slot
    const targetSlot = getInventorySlot(slotRef.area, slotRef.index);
    if (!targetSlot) return;
    if (!canAcceptStackInArea(slotRef.area, slotRef.index, dragState.item)) return;
    if (isSingleItemArea(slotRef.area) && !isEmptyStack(targetSlot)) return;

    const canPlace = isEmptyStack(targetSlot) ||
      (!isSingleItemArea(slotRef.area) && targetSlot.type === dragState.item.type && targetSlot.count < STACK_LIMIT);

    if (canPlace) {
      if (isEmptyStack(targetSlot)) {
        setStack(targetSlot, createStack(dragState.item.type, 1));
      } else {
        targetSlot.count++;
      }
      dragState.item.count--;
      const srcArea = dragState.sourceArea;
      if (dragState.item.count <= 0) clearDragState();
      if (slotRef.area === 'craft' || srcArea === 'craft') updateCraftingOutput();
    }
  } else {
    // Pick up half-stack from slot
    const srcSlot = getInventorySlot(slotRef.area, slotRef.index);
    if (!srcSlot || isEmptyStack(srcSlot)) return;

    const half = Math.ceil(srcSlot.count / 2);
    dragState.active = true;
    dragState.sourceArea = slotRef.area;
    dragState.sourceIndex = slotRef.index;
    dragState.item = createStack(srcSlot.type, half);
    srcSlot.count -= half;
    if (srcSlot.count <= 0) setStack(srcSlot, createStack());

    if (slotRef.area === 'craft') updateCraftingOutput();
  }
}

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
  mouse.down = false;
  mouse.rightDown = false;
  clearMenuAudioDrag();
  returnDraggedStack();
});

canvas.addEventListener('mousemove', event => {
  syncMouseFromEvent(event);
  if (gameState !== 'playing') updateMenuAudioDrag(event.clientX);
});
canvas.addEventListener('mousedown', event => {
  syncMouseFromEvent(event);
  if (gameState !== 'playing') {
    if (event.button === 0) {
      if (audioManager) audioManager.unlock();
      if (handleMenuAudioPointerDown(event.clientX, event.clientY)) return;
      handleMenuClick(event.clientX, event.clientY);
    }
    return;
  }
  if (player.dying || player.health <= 0) return;
  if (event.button === 0) {
    mouse.down = true;
    handleInventoryPrimaryDown();
    if (!inventory.open && !openUI && !isPointerOverInventoryUi()) {
      const prevBowCooldown = bowCooldown;
      fireArrow();
      if (bowCooldown > prevBowCooldown) {
        player.animState = 'bow'; player.animFrame = 0; player.animTick = 0; player.actionTick = 0;
      }
      const dmgBefore = getWeaponDamage();
      meleeAttackSlimes();
      if (dmgBefore > 0 && inventory.hotbar[inventory.selected]?.type !== BOW) {
        player.animState = 'attack'; player.animFrame = 0; player.animTick = 0; player.actionTick = 0;
      }
    }
  }
  if (event.button === 2) {
    mouse.rightDown = true;
    handleInventoryRightDown();
    if (!inventory.open && !isPointerOverInventoryUi()) handleWorldRightClick();
  }
});
window.addEventListener('mouseup', event => {
  if (event.button === 0) mouse.down = false;
  if (event.button === 2) mouse.rightDown = false;
  if (event.button === 0) clearMenuAudioDrag();
});
canvas.addEventListener('mouseleave', () => {
  mouse.down = false;
  mouse.rightDown = false;
  clearMenuAudioDrag();
});
canvas.addEventListener('contextmenu', event => event.preventDefault());

function addToInventory(type, amount = 1) {
  if (type === AIR || amount <= 0) return false;
  let remaining = amount;

  for (const slots of getInventorySlotGroups()) {
    for (const slot of slots) {
      if (slot.type !== type || slot.count <= 0 || slot.count >= STACK_LIMIT) continue;
      const transfer = Math.min(STACK_LIMIT - slot.count, remaining);
      slot.count += transfer;
      remaining -= transfer;
      if (remaining <= 0) return true;
    }
  }

  for (const slots of getInventorySlotGroups()) {
    for (const slot of slots) {
      if (!isEmptyStack(slot)) continue;
      const transfer = Math.min(STACK_LIMIT, remaining);
      setStack(slot, createStack(type, transfer));
      remaining -= transfer;
      if (remaining <= 0) return true;
    }
  }

  return remaining <= 0;
}

const MINE_RADIUS_PX = 6 * TILE;
const mining = { bx: -1, by: -1, progress: 0, active: false };

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  inventory.selected = mod(inventory.selected + (event.deltaY > 0 ? 1 : -1), inventory.hotbar.length);
}, { passive: false });

window.addEventListener('keydown', event => {
  const value = parseInt(event.key, 10);
  if (value >= 1 && value <= inventory.hotbar.length) inventory.selected = value - 1;
});

function getMineFrames(type) {
  const base = blockDefs[type]?.mine || 60;
  return Math.max(1, Math.round(base / getToolMultiplier(type)));
}

function isPointInRect(px, py, x, y, w, h) {
  return px >= x && px < x + w && py >= y && py < y + h;
}

function getInventoryMetrics() {
  const compact = canvas.width < 520;
  const slotW = compact ? 34 : canvas.width < 720 ? 40 : 48;
  const slotH = slotW;
  const gap = compact ? 5 : 7;
  const panelPad = compact ? 10 : 14;
  const headerH = 28;
  const labelH = 20;

  const hotbarW = HOTBAR_SIZE * slotW + (HOTBAR_SIZE - 1) * gap;
  const hotbarX = Math.floor((canvas.width - hotbarW) / 2);
  const hotbarY = Math.floor(canvas.height - slotH - 18);

  // Crafting section dimensions
  const craftGridSize = 3 * slotW + 2 * gap;  // 3×3 grid width/height
  const arrowW = compact ? 26 : 34;
  const craftSectionW = craftGridSize + arrowW + slotW;

  // Equipment section dimensions (armor + accessories side by side)
  const equipLabelW = compact ? 32 : 42;
  const accLabelW = compact ? 26 : 34;
  const equipSectionW = equipLabelW + gap + slotW + gap + accLabelW + gap + slotW;
  const equipH = Math.max(4, ACC_SLOTS) * slotH + (Math.max(4, ACC_SLOTS) - 1) * gap;

  // Backpack dimensions
  const backpackGridW = BACKPACK_COLS * slotW + (BACKPACK_COLS - 1) * gap;
  const backpackGridH = BACKPACK_ROWS * slotH + (BACKPACK_ROWS - 1) * gap;

  // Full panel
  const upperInnerW = equipSectionW + panelPad + craftSectionW;
  const panelInnerW = Math.max(upperInnerW, backpackGridW);
  const panelW = panelInnerW + 2 * panelPad;
  const panelX = Math.floor((canvas.width - panelW) / 2);

  const upperH = labelH + Math.max(equipH, craftGridSize) + 8;
  const backpackSectionH = labelH + backpackGridH + 8;
  const panelH = headerH + upperH + 8 + backpackSectionH + panelPad;
  const panelY = Math.max(4, hotbarY - panelH - 14);

  // Upper section Y positions
  const upperY = panelY + headerH;
  const upperContentY = upperY + labelH;

  // Equipment positions (armor left, accessories right)
  const equipX = panelX + panelPad;
  const equipSlotX = equipX + equipLabelW + gap;
  const accLabelX = equipSlotX + slotW + gap;
  const accSlotX = accLabelX + (compact ? 26 : 34) + gap;

  // Crafting positions
  const craftAreaX = equipX + equipSectionW + panelPad;
  const craftGridX = craftAreaX;
  const craftArrowX = craftGridX + craftGridSize;
  const craftOutX = craftArrowX + arrowW;
  const craftOutY = upperContentY + Math.floor((craftGridSize - slotH) / 2);

  // Backpack section
  const backpackSectionY = upperY + upperH + 8;
  const backpackGridX = panelX + panelPad;
  const backpackGridY = backpackSectionY + labelH;

  return {
    slotW, slotH, gap, panelPad, headerH, labelH,
    hotbar: { x: hotbarX, y: hotbarY, w: hotbarW, h: slotH },
    panel: { x: panelX, y: panelY, w: panelW, h: panelH },
    upper: { y: upperY, contentY: upperContentY },
    equip: { x: equipX, y: upperContentY, slotX: equipSlotX, labelW: equipLabelW, h: equipH },
    acc: { x: accLabelX, y: upperContentY, slotX: accSlotX },
    craft: {
      x: craftAreaX, y: upperContentY,
      gridX: craftGridX, gridSize: craftGridSize,
      arrowX: craftArrowX, arrowW,
      outX: craftOutX, outY: craftOutY,
    },
    backpack: {
      x: panelX, y: backpackSectionY, w: panelW,
      labelX: panelX + panelPad, labelY: backpackSectionY + 14,
      gridX: backpackGridX, gridY: backpackGridY,
    },
  };
}

function getSlotRect(area, index, metrics = getInventoryMetrics()) {
  const { slotW, slotH, gap } = metrics;

  if (area === 'hotbar') {
    if (index < 0 || index >= HOTBAR_SIZE) return null;
    return { x: Math.floor(metrics.hotbar.x + index * (slotW + gap)), y: metrics.hotbar.y, w: slotW, h: slotH };
  }
  if (area === 'backpack') {
    if (index < 0 || index >= BACKPACK_SIZE) return null;
    const col = index % BACKPACK_COLS;
    const row = Math.floor(index / BACKPACK_COLS);
    return {
      x: Math.floor(metrics.backpack.gridX + col * (slotW + gap)),
      y: Math.floor(metrics.backpack.gridY + row * (slotH + gap)),
      w: slotW, h: slotH,
    };
  }
  if (area === 'craft') {
    if (index < 0 || index >= CRAFT_SIZE) return null;
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
      x: Math.floor(metrics.craft.gridX + col * (slotW + gap)),
      y: Math.floor(metrics.craft.y + row * (slotH + gap)),
      w: slotW, h: slotH,
    };
  }
  if (area === 'equip') {
    if (index < 0 || index >= 4) return null;
    return {
      x: metrics.equip.slotX,
      y: Math.floor(metrics.equip.y + index * (slotH + gap)),
      w: slotW, h: slotH,
    };
  }
  if (area === 'acc') {
    if (index < 0 || index >= ACC_SLOTS) return null;
    return {
      x: metrics.acc.slotX,
      y: Math.floor(metrics.acc.y + index * (slotH + gap)),
      w: slotW, h: slotH,
    };
  }
  if (area === 'craftout') {
    if (index !== 0) return null;
    return { x: metrics.craft.outX, y: metrics.craft.outY, w: slotW, h: slotH };
  }
  return null;
}

function getUiSlotAt(x, y) {
  const metrics = getInventoryMetrics();

  // Chest UI slots
  if (openUI?.type === 'chest') {
    const cols = 5, sW = 44, sH = 44, pad = 14;
    const panelW = cols * sW + pad * 2;
    const panelH = 4 * sH + pad * 2 + 28;
    const px = Math.round(canvas.width / 2 - panelW / 2);
    const py = Math.max(4, metrics.panel.y - panelH - 8);
    for (let i = 0; i < CHEST_SLOTS; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const sx = px + pad + col * sW, sy = py + pad + 20 + row * sH;
      if (isPointInRect(x, y, sx, sy, sW, sH)) return { area: 'chest', index: i };
    }
  }

  // Furnace UI slots
  if (openUI?.type === 'furnace') {
    const sW = 48, sH = 48, pad = 16;
    const panelW = 260, panelH = 170;
    const px = Math.round(canvas.width / 2 - panelW / 2);
    const py = Math.round(canvas.height / 2 - panelH / 2);
    const oreX = px + pad, oreY = py + 36;
    if (isPointInRect(x, y, oreX, oreY, sW, sH)) return { area: 'furnaceOre', index: 0 };
    const fuelX = px + pad, fuelY = py + 100;
    if (isPointInRect(x, y, fuelX, fuelY, sW, sH)) return { area: 'furnaceFuel', index: 0 };
    const outX = px + pad + sW + 12 + 80 + 12, outY = py + 50;
    if (isPointInRect(x, y, outX, outY, sW, sH)) return { area: 'furnaceOut', index: 0 };
  }

  if (inventory.open) {
    const outRect = getSlotRect('craftout', 0, metrics);
    if (outRect && isPointInRect(x, y, outRect.x, outRect.y, outRect.w, outRect.h)) {
      return { area: 'craftout', index: 0 };
    }
    for (let i = 0; i < CRAFT_SIZE; i++) {
      const rect = getSlotRect('craft', i, metrics);
      if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
        return { area: 'craft', index: i };
      }
    }
    for (let i = 0; i < 4; i++) {
      const rect = getSlotRect('equip', i, metrics);
      if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
        return { area: 'equip', index: i };
      }
    }
    for (let i = 0; i < ACC_SLOTS; i++) {
      const rect = getSlotRect('acc', i, metrics);
      if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
        return { area: 'acc', index: i };
      }
    }
    for (let i = 0; i < BACKPACK_SIZE; i++) {
      const rect = getSlotRect('backpack', i, metrics);
      if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
        return { area: 'backpack', index: i };
      }
    }
  }

  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const rect = getSlotRect('hotbar', i, metrics);
    if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
      return { area: 'hotbar', index: i };
    }
  }
  return null;
}

function isPointerOverInventoryUi(x = mouse.x, y = mouse.y) {
  const metrics = getInventoryMetrics();
  if (inventory.open && isPointInRect(x, y, metrics.panel.x, metrics.panel.y, metrics.panel.w, metrics.panel.h)) {
    return true;
  }
  if (openUI?.type === 'chest') {
    const cols = 5, sW = 44, sH = 44, pad = 14;
    const panelW = cols * sW + pad * 2;
    const panelH = 4 * sH + pad * 2 + 28;
    const px = Math.round(canvas.width / 2 - panelW / 2);
    const py = Math.max(4, metrics.panel.y - panelH - 8);
    if (isPointInRect(x, y, px, py, panelW, panelH)) return true;
  }
  if (openUI?.type === 'furnace') {
    const panelW = 260, panelH = 170;
    const px = Math.round(canvas.width / 2 - panelW / 2);
    const py = Math.round(canvas.height / 2 - panelH / 2);
    if (isPointInRect(x, y, px, py, panelW, panelH)) return true;
  }
  return isPointInRect(x, y, metrics.hotbar.x, metrics.hotbar.y, metrics.hotbar.w, metrics.hotbar.h);
}

function updateMining(scale = 1) {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  const blockType = getBlock(wx, wy);
  const heldItem = inventory.hotbar[inventory.selected]?.type ?? AIR;
  const canMine = mouse.down && !dragState.active && !isPointerOverInventoryUi() && !openUI &&
    heldItem !== BOW && heldItem !== SWORD_COPPER && heldItem !== SWORD_STONE &&
    heldItem !== SWORD_IRON && heldItem !== SWORD_GOLD && heldItem !== SWORD_DIAMOND &&
    dist <= MINE_RADIUS_PX && isMineable(blockType);

  if (!canMine) {
    mining.active = false;
    if (!mouse.down || wx !== mining.bx || wy !== mining.by) {
      mining.bx = -1;
      mining.by = -1;
      mining.progress = 0;
    }
    return;
  }

  if (wx !== mining.bx || wy !== mining.by) {
    mining.bx = wx;
    mining.by = wy;
    mining.progress = 0;
  }

  player.facing = wx * TILE + TILE / 2 >= pcx ? 1 : -1;
  mining.active = true;
  mining.progress += scale;

  if (mining.progress >= getMineFrames(blockType)) {
    const key = blockKey(wx, wy);
    if (blockType === CHEST) {
      // Return chest contents to inventory first
      const contents = chests.get(key);
      if (contents) { for (const s of contents) if (!isEmptyStack(s)) addToInventory(s.type, s.count); }
      chests.delete(key);
      if (openUI?.key === key) openUI = null;
    }
    if (blockType === FURNACE) {
      const f = furnaces.get(key);
      if (f) {
        if (!isEmptyStack(f.ore)) addToInventory(f.ore.type, f.ore.count);
        if (!isEmptyStack(f.fuel)) addToInventory(f.fuel.type, f.fuel.count);
        if (!isEmptyStack(f.out)) addToInventory(f.out.type, f.out.count);
      }
      furnaces.delete(key);
      if (openUI?.key === key) openUI = null;
    }
    const drops = blockType === TREE ? breakTreeFrom(wx, wy) : 1;
    if (blockType !== TREE) setBlock(wx, wy, AIR);
    addToInventory(getDropType(blockType), drops);
    mining.bx = -1;
    mining.by = -1;
    mining.progress = 0;
    mining.active = false;
  }
}

let lastPlaceFrame = -1;
function updatePlacement(frame) {
  if (!mouse.rightDown || frame === lastPlaceFrame || dragState.active || isPointerOverInventoryUi() || openUI) return;
  lastPlaceFrame = frame;

  const slot = inventory.hotbar[inventory.selected];
  if (!slot || slot.type === AIR || slot.count <= 0) return;
  // Only placeable if it's a block type (has a blockDef)
  if (!blockDefs[slot.type]) return;

  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);
  if (getBlock(wx, wy) !== AIR) return;

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  if (dist > MINE_RADIUS_PX) return;

  const adjacent = isSolid(getBlock(wx - 1, wy)) || isSolid(getBlock(wx + 1, wy)) ||
    isSolid(getBlock(wx, wy - 1)) || isSolid(getBlock(wx, wy + 1));
  if (!adjacent) return;

  const blockLeft = wx * TILE;
  const blockTop = wy * TILE;
  const overlaps = blockLeft + TILE > player.x && blockLeft < player.x + player.w &&
    blockTop + TILE > player.y && blockTop < player.y + player.h;
  if (overlaps) return;

  setBlock(wx, wy, slot.type);
  setWater(wx, wy, 0);
  slot.count--;
  if (slot.count <= 0) {
    slot.count = 0;
    slot.type = AIR;
  }
}

function updatePlayer(scale = 1) {
  player.jumpAnimRestart = false;
  if (player.dying) return; // death animation handled separately
  if (player.iframes > 0) player.iframes = Math.max(0, player.iframes - scale);
  const waterCoverageStart = sampleWaterCoverage(player.x, player.y, player.w, player.h);
  player.waterExitFrames = Math.max(0, player.waterExitFrames - scale);
  const rawInWaterStart = waterCoverageStart > PLAYER_WET_THRESHOLD;
  const inWaterStart = rawInWaterStart && player.waterExitFrames <= 0;
  const jumpHeld = !!(keys['Space'] || keys['KeyW'] || keys['ArrowUp']);
  const jumpPressed = jumpHeld && !player.jumpLatch;
  const centerX = player.x + player.w * 0.5;
  const headInWater = isPointInWater(centerX, player.y + 6);
  const justAboveHeadInWater = isPointInWater(centerX, player.y - 2);
  const nearSurface = headInWater && !justAboveHeadInWater;
  const canWaterLaunch = rawInWaterStart && jumpPressed && (!headInWater || nearSurface || waterCoverageStart < 0.65);
  const canWaterExitStep = (rawInWaterStart || player.inWater || nearSurface || player.waterExitFrames > 0) && (jumpHeld || player.vy < -1);
  const speedBase = (keys['ShiftLeft'] || keys['ShiftRight'] ? RUN_SPEED : WALK_SPEED) * getSpeedMult();
  const speed = speedBase * (inWaterStart ? WATER_SPEED_MULT : 1);
  let moveX = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) {
    moveX = -speed * scale;
    player.facing = -1;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    moveX = speed * scale;
    player.facing = 1;
  }

  player.x += moveX;
  if (collidesWithWorld(player.x, player.y, player.w, player.h)) {
    let steppedUp = false;
    if (moveX !== 0) {
      const stepHeights = [];
      if (player.onGround) stepHeights.push(TILE);
      if (canWaterExitStep) stepHeights.push(TILE, TILE * 2);

      for (const stepHeight of stepHeights) {
        if (!collidesWithWorld(player.x, player.y - stepHeight, player.w, player.h)) {
          player.y -= stepHeight;
          steppedUp = true;
          break;
        }
      }
    }

    if (steppedUp) {
      player.blockedX = false;
    } else {
      player.x -= moveX;
      player.blockedX = moveX !== 0;
    }
  } else {
    player.blockedX = false;
  }

  const supportedInWater = inWaterStart && !jumpHeld && player.vy >= 0 &&
    checkOnGround(player.x, player.y, player.w, player.h);

  if (supportedInWater) {
    player.vy = 0;
  } else {
    if (inWaterStart) player.vy *= Math.pow(0.88, scale);

    const gravity = inWaterStart ? GRAVITY * WATER_GRAVITY_MULT : GRAVITY;
    const maxFall = inWaterStart ? WATER_MAX_FALL : MAX_FALL;
    player.vy = Math.min(player.vy + gravity * scale, maxFall);

    if (canWaterLaunch) {
      player.vy = WATER_EXIT_JUMP_VEL;
      player.inWater = false;
      player.waterExitFrames = 12;
      player.jumpAnimRestart = true;
    } else if (inWaterStart && jumpHeld) {
      player.vy = Math.max(player.vy - WATER_SWIM_ACCEL * scale, -4.4);
    }
  }

  const prevVy = player.vy;
  player.y += player.vy;
  if (collidesWithWorld(player.x, player.y, player.w, player.h)) {
    if (player.vy > 0) {
      player.y = Math.floor((player.y + player.h) / TILE) * TILE - player.h;
      player.vy = 0;
      // Fall damage: only when landing hard and not in water
      const FALL_THRESHOLD = 14.8;
      if (prevVy > FALL_THRESHOLD && !inWaterStart && !hasAccessory(ACC_HORSESHOE)) {
        const dmg = Math.floor((prevVy - FALL_THRESHOLD) / 1.5) + 1;
        applyDamageToPlayer(dmg);
      }
    } else {
      player.y = Math.ceil(player.y / TILE) * TILE;
      player.vy = 0;
    }
  }

  player.onGround = checkOnGround(player.x, player.y, player.w, player.h);
  if (player.onGround) player.doubleJumpUsed = false;
  const jumpVelMod = JUMP_VEL * getJumpMult();
  if (!rawInWaterStart && jumpHeld && player.onGround) {
    player.vy = jumpVelMod;
    player.onGround = false;
    player.jumpAnimRestart = true;
  } else if (!rawInWaterStart && jumpPressed && !player.onGround && !player.doubleJumpUsed && hasAccessory(ACC_CLOUD_BOTTLE)) {
    player.vy = jumpVelMod * 0.85;
    player.doubleJumpUsed = true;
  }

  player.x = clamp(player.x, 0, WORLD_PX - player.w);
  player.y = clamp(player.y, 0, WORLD_H * TILE - player.h);

  const waterCoverageEnd = sampleWaterCoverage(player.x, player.y, player.w, player.h);
  const rawInWaterEnd = waterCoverageEnd > PLAYER_WET_THRESHOLD;
  player.inWater = rawInWaterEnd && player.waterExitFrames <= 0;
  player.fullySubmerged = waterCoverageEnd >= PLAYER_SUBMERGED_THRESHOLD && player.waterExitFrames <= 0;

  if (player.fullySubmerged) {
    player.air = Math.max(0, player.air - scale);
    if (player.air <= 0) {
      player.drownTick += scale;
      if (player.drownTick >= DROWN_DAMAGE_FRAMES) {
        player.drownTick = 0;
        applyDamageToPlayer(2);
      }
    }
  } else {
    const airRecovery = player.inWater ? 1.6 : 4.5;
    player.air = Math.min(player.maxAir, player.air + airRecovery * scale);
    player.drownTick = 0;
  }

  player.jumpLatch = jumpHeld;
}

function updateCamera(scale = 1) {
  const targetX = player.x + player.w / 2 - canvas.width / 2;
  const targetY = player.y + player.h / 2 - canvas.height * 0.4;
  cam.x += (targetX - cam.x) * 0.1 * scale;
  cam.y += (targetY - cam.y) * 0.1 * scale;
  cam.x = clamp(cam.x, 0, Math.max(0, WORLD_PX - canvas.width));
  cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H * TILE - canvas.height));
}

function updateAnimation(scale = 1) {
  let newState = 'stand';
  const moving = (keys['KeyA'] || keys['KeyD'] || keys['ArrowLeft'] || keys['ArrowRight']) && !player.blockedX;
  const running = keys['ShiftLeft'] || keys['ShiftRight'];

  // Decay action animations
  if (player.animState === 'attack' || player.animState === 'bow') {
    player.actionTick = (player.actionTick || 0) + scale;
    const frameCount = player.animState === 'bow' ? 4 : 4;
    const tpf = 5;
    player.animTick += scale;
    if (player.animTick >= tpf) {
      player.animTick = 0;
      if (player.animState === 'bow') {
        // bow frames span two rows; handle wrap manually
        player.animFrame = Math.min(player.animFrame + 1, frameCount - 1);
      } else {
        player.animFrame = (player.animFrame + 1) % frameCount;
      }
    }
    if (player.actionTick >= frameCount * tpf) {
      player.animState = 'stand';
      player.animFrame = 0;
      player.animTick = 0;
      player.actionTick = 0;
    }
    return;
  }

  if (!player.onGround) newState = 'jump';
  else if (mining.active) newState = 'mine';
  else if (moving && running) newState = 'run';
  else if (moving) newState = 'walk';

  if (newState !== player.animState || (newState === 'jump' && player.jumpAnimRestart)) {
    player.animState = newState;
    player.animFrame = 0;
    player.animTick = 0;
  }

  const fps = { stand: 4, walk: 10, run: 12, jump: 8, mine: 10 }[newState] || 4;
  const frameCount = { stand: 1, walk: 8, run: 8, jump: 6, mine: 4 }[newState] || 1;
  const ticksPerFrame = Math.round(60 / fps);

  player.animTick += scale;
  if (player.animTick >= ticksPerFrame) {
    player.animTick = 0;
    if (newState === 'jump' && player.inWater) player.animFrame = (player.animFrame + 1) % 3;
    else if (newState === 'jump') player.animFrame = Math.min(player.animFrame + 1, frameCount - 1);
    else player.animFrame = (player.animFrame + 1) % frameCount;
  }
}

const DEATH_FREEZE_TICKS = 120; // frames to hold last frame before respawn

function updateDeathAnim(scale = 1) {
  if (!player.dying) return;
  // Still animating through frames
  if (player.deathFrame < DEATH_FRAMES.length - 1) {
    player.deathTick += scale;
    if (player.deathTick >= DEATH_TICKS_PER_FRAME) {
      player.deathTick = 0;
      player.deathFrame = Math.min(player.deathFrame + 1, DEATH_FRAMES.length - 1);
    }
  } else {
    // Frozen on last frame — count down then respawn
    player.deathTick += scale;
    if (player.deathTick >= DEATH_FREEZE_TICKS) {
      respawnPlayer();
    }
  }
}

function updateWorld(dt) {
  dayClockMs = mod(dayClockMs + dt, DAY_LENGTH_MS);
  const steps = clamp(Math.round(dt / TARGET_DT) * WATER_STEPS_PER_FRAME, 1, 4);
  for (let i = 0; i < steps; i++) simulateWaterStep();
  updateFurnaces(dt / TARGET_DT);
  updateArrows(dt / TARGET_DT);
  updateSlimes(dt / TARGET_DT);
}

function daylightFactor() {
  return clamp((Math.sin(dayClockMs / DAY_LENGTH_MS * TAU - Math.PI / 2) + 1) / 2, 0, 1);
}

function drawStars(daylight) {
  const alpha = Math.pow(1 - daylight, 1.6);
  if (alpha <= 0.01) return;

  ctx.save();
  for (const star of stars) {
    const twinkle = 0.6 + 0.4 * Math.sin(dayClockMs * 0.002 + star.twinkle);
    ctx.fillStyle = `rgba(255,255,255,${(alpha * twinkle).toFixed(3)})`;
    const x = Math.floor(star.u * canvas.width);
    const y = Math.floor(star.v * canvas.height);
    ctx.fillRect(x, y, star.size, star.size);
    if (star.size > 1) {
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillRect(x - 1, y + 1, 1, 1);
    }
  }
  ctx.restore();
}

function drawSunAndMoon(daylight) {
  const phase = dayClockMs / DAY_LENGTH_MS;
  const sunX = canvas.width * phase;
  const sunY = canvas.height * (0.82 - Math.sin(phase * Math.PI) * 0.56);
  const moonPhase = mod(phase + 0.5, 1);
  const moonX = canvas.width * moonPhase;
  const moonY = canvas.height * (0.82 - Math.sin(moonPhase * Math.PI) * 0.56);

  ctx.save();
  if (daylight > 0.08) {
    ctx.fillStyle = alphaColor('#fff6c2', 0.18 + daylight * 0.16);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mixColor('#ffd55f', '#fff4c0', daylight);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, TAU);
    ctx.fill();
  }
  if (daylight < 0.92) {
    const moonAlpha = Math.pow(1 - daylight, 1.1);
    ctx.fillStyle = alphaColor('#d9e7ff', 0.2 * moonAlpha);
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = alphaColor('#f4f8ff', 0.9 * moonAlpha);
    ctx.beginPath();
    ctx.arc(moonX, moonY, 14, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawCloudShape(x, y, w, h, daylight) {
  const shadow = mixColor('#9cb3cf', '#d9ecff', daylight, 0.4 + daylight * 0.22);
  const body = mixColor('#d7e6f6', '#ffffff', daylight, 0.55 + daylight * 0.22);
  ctx.fillStyle = shadow;
  ctx.fillRect(Math.floor(x + 8), Math.floor(y + h * 0.6), Math.floor(w * 0.75), Math.floor(h * 0.34));
  ctx.fillStyle = body;
  ctx.fillRect(Math.floor(x), Math.floor(y + h * 0.35), Math.floor(w * 0.52), Math.floor(h * 0.38));
  ctx.fillRect(Math.floor(x + w * 0.24), Math.floor(y), Math.floor(w * 0.38), Math.floor(h * 0.5));
  ctx.fillRect(Math.floor(x + w * 0.48), Math.floor(y + h * 0.16), Math.floor(w * 0.36), Math.floor(h * 0.42));
}

function drawClouds(daylight) {
  ctx.save();
  for (const cloud of clouds) {
    const offsetX = mod(cloud.x + dayClockMs * 0.012 * cloud.speed, WORLD_PX + 220) - 110;
    const x = offsetX - cam.x * 0.22;
    const y = cloud.y + Math.sin(dayClockMs * 0.001 + cloud.speed) * 2;
    drawCloudShape(x, y, cloud.w, cloud.h, daylight);
  }
  ctx.restore();
}

function drawMountains(daylight) {
  ctx.save();
  for (const layer of mountainLayers) {
    ctx.beginPath();
    ctx.moveTo(-20, canvas.height);
    for (let x = 0; x < WORLD_W; x += 2) {
      const screenX = x * TILE - cam.x * layer.parallax;
      const screenY = canvas.height * layer.profile[x];
      ctx.lineTo(screenX, screenY);
    }
    ctx.lineTo(WORLD_PX - cam.x * layer.parallax + 20, canvas.height);
    ctx.closePath();
    ctx.fillStyle = mixColor(layer.nightColor, layer.dayColor, daylight);
    ctx.fill();
  }
  ctx.restore();
}

function drawSky() {
  const daylight = daylightFactor();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, mixColor('#08111d', '#69b7f5', daylight));
  gradient.addColorStop(0.72, mixColor('#20344d', '#dff1ff', daylight));
  gradient.addColorStop(1, mixColor('#2a3044', '#f3d79c', daylight * 0.7));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(daylight);
  drawSunAndMoon(daylight);
  drawMountains(daylight);
  drawClouds(daylight);

  const nightOverlay = ((1 - daylight) * 0.12).toFixed(3);
  ctx.fillStyle = `rgba(0,0,0,${nightOverlay})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCaveWall(tileX, tileY, screenX, screenY) {
  const depth = tileY - surfaceYs[tileX];
  const wall = depth > 34 ? wallTextures.deep : wallTextures.shallow;
  ctx.drawImage(wall, screenX, screenY);
  const darkness = clamp((depth - 6) / 72, 0, 0.46);
  ctx.fillStyle = `rgba(5,8,16,${darkness})`;
  ctx.fillRect(screenX, screenY, TILE, TILE);
}

function drawBlockTile(type, tileX, tileY, screenX, screenY) {
  ctx.drawImage(tileTextures[type], screenX, screenY);

  if (type === GRASS) {
    ctx.fillStyle = alphaColor(biomeGrassTints[biomes[tileX]], 0.18);
    ctx.fillRect(screenX, screenY, TILE, 5);
  }
  if (!hasBlock(getBlock(tileX, tileY - 1))) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(screenX, screenY, TILE, 2);
  }
  if (!hasBlock(getBlock(tileX - 1, tileY))) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(screenX, screenY, 1, TILE);
  }
  if (!hasBlock(getBlock(tileX + 1, tileY))) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(screenX + TILE - 2, screenY, 2, TILE);
  }
  if (!hasBlock(getBlock(tileX, tileY + 1))) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(screenX, screenY + TILE - 2, TILE, 2);
  }
}

function drawWorld() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const startX = Math.max(0, Math.floor(camX / TILE) - 1);
  const endX = Math.min(WORLD_W, Math.ceil((camX + canvas.width) / TILE) + 1);
  const startY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endY = Math.min(WORLD_H, Math.ceil((camY + canvas.height) / TILE) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const type = getBlock(x, y);
      const sx = (x * TILE - camX) | 0;
      const sy = (y * TILE - camY) | 0;
      if (type === AIR) {
        if (y > surfaceYs[x]) drawCaveWall(x, y, sx, sy);
        continue;
      }
      drawBlockTile(type, x, y, sx, sy);
    }
  }
}

function drawWater() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const startX = Math.max(0, Math.floor(camX / TILE) - 1);
  const endX = Math.min(WORLD_W, Math.ceil((camX + canvas.width) / TILE) + 1);
  const startY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endY = Math.min(WORLD_H, Math.ceil((camY + canvas.height) / TILE) + 1);

  ctx.save();
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const amount = getWater(x, y);
      if (amount <= WATER_RENDER_EPS) continue;
      const aboveAmount = getWater(x, y - 1);
      const belowAmount = getWater(x, y + 1);
      const isSurface = aboveAmount <= WATER_RENDER_EPS;
      const hasFloorEdge = belowAmount <= WATER_RENDER_EPS;

      const sx = (x * TILE - camX) | 0;
      const sy = (y * TILE - camY) | 0;
      const fillHeight = Math.max(2, Math.min(TILE, Math.round(clamp(amount, 0, WATER_MAX) * TILE)));
      const top = sy + TILE - fillHeight;
      const shimmer = 0.16 + ((Math.sin(dayClockMs * 0.008 + x * 0.75 + y * 0.2) + 1) * 0.5) * 0.12;

      ctx.fillStyle = 'rgba(33,108,206,0.64)';
      ctx.fillRect(sx, top, TILE, fillHeight);
      if (isSurface) {
        ctx.fillStyle = `rgba(178,233,255,${shimmer.toFixed(3)})`;
        ctx.fillRect(sx, top, TILE, Math.min(2, fillHeight));
      }
      if (hasFloorEdge) {
        ctx.fillStyle = 'rgba(7,36,97,0.18)';
        ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
      }
    }
  }
  ctx.restore();
}

function drawLeafBlob(x, y, w, h, palette) {
  ctx.fillStyle = palette.base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = palette.light;
  ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, Math.floor(h * 0.28)));
  ctx.fillStyle = palette.dark;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function drawTreeCanopies() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);

  for (const tree of treeCanopies) {
    if (getBlock(tree.x, tree.trunkTopY) !== TREE) continue;
    const palette = tree.biome === BIOME_MEADOW
      ? { base: '#77c64d', light: '#99ea6c', dark: '#467b2c' }
      : tree.biome === BIOME_ROCKY
        ? { base: '#6aab45', light: '#8fcb64', dark: '#3f6f28' }
        : { base: '#63b440', light: '#8cde65', dark: '#3e6f27' };

    const topX = tree.x * TILE - camX + TILE / 2;
    const topY = tree.trunkTopY * TILE - camY;
    const size = tree.radius * 8;
    const blobs = [
      { x: topX - size - 8, y: topY - size * 0.2, w: size + 8, h: size * 0.8 },
      { x: topX - size * 0.35, y: topY - size - 4, w: size + 10, h: size * 0.9 },
      { x: topX + size * 0.15, y: topY - size * 0.4, w: size, h: size * 0.78 },
      { x: topX - size * 0.7, y: topY + 1, w: size + 18, h: size * 0.58 },
    ];

    for (const blob of blobs) {
      drawLeafBlob(Math.floor(blob.x), Math.floor(blob.y), Math.floor(blob.w), Math.floor(blob.h), palette);
    }
  }
}

function drawPlayer() {
  if (!spritesheet.complete || spritesheet.naturalWidth === 0) {
    ctx.fillStyle = 'rgba(255,200,0,0.9)';
    ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.h);
    return;
  }

  let srcX;
  let srcY;
  if (player.dying) {
    const f = DEATH_FRAMES[Math.min(player.deathFrame, DEATH_FRAMES.length - 1)];
    srcX = f.col * FRAME_SIZE;
    srcY = f.row * FRAME_SIZE;
  } else if (player.animState === 'run') {
    const globalFrame = player.animFrame + 4;
    srcX = (globalFrame % SHEET_COLS) * FRAME_SIZE;
    srcY = Math.floor(globalFrame / SHEET_COLS) * FRAME_SIZE;
  } else if (player.animState === 'bow') {
    // Frames 29-32 (0-indexed): global frame = 29 + animFrame
    const globalFrame = 29 + player.animFrame;
    srcX = (globalFrame % SHEET_COLS) * FRAME_SIZE;
    srcY = Math.floor(globalFrame / SHEET_COLS) * FRAME_SIZE;
  } else {
    const anim = ANIM[player.animState];
    if (!anim) return;
    srcX = (anim.colStart + player.animFrame) * FRAME_SIZE;
    srcY = anim.row * FRAME_SIZE;
  }

  const drawSize = player.h;
  const screenX = player.x - cam.x + (player.w - drawSize) / 2;
  const screenY = player.y - cam.y;

  // Hit flash: blink red while invincibility frames are active
  const hitFlash = !player.dying && player.iframes > 0 && Math.floor(player.iframes / 4) % 2 === 1;

  // Build the source image: either raw sprite or red-tinted sprite
  let spriteSrc = spritesheet;
  if (hitFlash) {
    hitCtx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    hitCtx.drawImage(spritesheet, srcX, srcY, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
    // source-in: fill red only where pixels are already non-transparent
    hitCtx.globalCompositeOperation = 'source-in';
    hitCtx.fillStyle = 'rgba(255,60,60,0.85)';
    hitCtx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    hitCtx.globalCompositeOperation = 'source-over';
    spriteSrc = hitCanvas;
    srcX = 0; srcY = 0;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (player.facing === -1) {
    ctx.translate(screenX + drawSize / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spriteSrc, srcX, srcY, FRAME_SIZE, FRAME_SIZE, -drawSize / 2, screenY, drawSize, drawSize);
  } else {
    ctx.drawImage(spriteSrc, srcX, srcY, FRAME_SIZE, FRAME_SIZE, screenX, screenY, drawSize, drawSize);
  }
  ctx.restore();

  // Air bar above player's head — only when in water or not fully recovered
  if (player.inWater || player.air < player.maxAir) {
    const barW = 28;
    const barH = 3;
    const barX = Math.round(player.x - cam.x + (player.w - barW) / 2);
    const barY = Math.round(player.y - cam.y) - 7;
    const airRatio = clamp(player.air / player.maxAir, 0, 1);

    // Outline
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    // Fill (transparent when empty)
    if (airRatio > 0) {
      ctx.fillStyle = `rgba(50,60,95,${0.5 + airRatio * 0.5})`;
      ctx.fillRect(barX, barY, Math.round(barW * airRatio), barH);
    }
  }
}

function drawMining() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  const target = getBlock(wx, wy);
  const inRange = dist <= MINE_RADIUS_PX && isMineable(target);

  if (inRange) {
    const sx = (wx * TILE - camX) | 0;
    const sy = (wy * TILE - camY) | 0;
    const pulse = 0.45 + Math.sin(dayClockMs * 0.01) * 0.15;
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
  }

  if (mining.bx >= 0) {
    const sx = (mining.bx * TILE - camX) | 0;
    const sy = (mining.by * TILE - camY) | 0;
    const type = getBlock(mining.bx, mining.by);
    const progress = type === AIR ? 1 : clamp(mining.progress / getMineFrames(type), 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${(progress * 0.58).toFixed(2)})`;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(sx, sy + TILE + 2, TILE, 4);
    ctx.fillStyle = mixColor('#ff6545', '#7cff7a', progress);
    ctx.fillRect(sx, sy + TILE + 2, Math.round(TILE * progress), 4);
  }
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,11,18,0.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function drawText(text, x, y, color = '#ffffff', font = '14px Minecraft, monospace', align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

const HEART_PATTERN = [
  '01100110',
  '11111111',
  '11111111',
  '01111110',
  '00111100',
  '00011000',
];

function drawHeart(x, y, size, filled) {
  const pixelSize = Math.max(1, Math.floor(size / HEART_PATTERN[0].length));
  for (let row = 0; row < HEART_PATTERN.length; row++) {
    for (let col = 0; col < HEART_PATTERN[row].length; col++) {
      if (HEART_PATTERN[row][col] !== '1') continue;
      ctx.fillStyle = filled ? '#ff5757' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
      if (filled && row < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, 1);
      }
    }
  }
}

function getDepthLabel(depth) {
  if (depth < 6) return 'Surface';
  if (depth < 28) return 'Underground';
  return 'Caverns';
}

function drawStatusHud() {
  const tileX = clamp(Math.floor((player.x + player.w / 2) / TILE), 0, WORLD_W - 1);
  const depth = Math.max(0, Math.floor(player.y / TILE - surfaceYs[tileX]));
  const stage = getDepthLabel(depth);
  const showAir = player.inWater || player.air < player.maxAir;

  const heartFlash = player.iframes > 0 && Math.floor(player.iframes / 5) % 2 === 0;
  if (!heartFlash) {
    for (let i = 0; i < player.maxHealth; i++) {
      drawHeart(18 + i * 22, 18, 16, i < player.health);
    }
  }

  // Armor bar: small shield icons below hearts
  const defense = getTotalDefense();
  const hasArmor = equipment.some(s => !isEmptyStack(s));
  if (defense > 0 || hasArmor) {
    // Show up to 10 icons; each icon = ceil(maxDefense/10) defense
    const maxDefense = 24;
    const ICON_COUNT = 10;
    const perIcon = maxDefense / ICON_COUNT;
    for (let i = 0; i < ICON_COUNT; i++) {
      const sx = 18 + i * 16, sy = 38;
      const filled = defense >= (i + 1) * perIcon;
      const partial = !filled && defense > i * perIcon;
      ctx.fillStyle = filled ? '#6ad4ff' : partial ? 'rgba(106,212,255,0.45)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(sx + 5, sy); ctx.lineTo(sx + 10, sy + 3);
      ctx.lineTo(sx + 10, sy + 8); ctx.lineTo(sx + 5, sy + 11);
      ctx.lineTo(sx, sy + 8); ctx.lineTo(sx, sy + 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5; ctx.stroke();
    }
  }

  drawPanel(16, 56, 202, 68);
  drawText(`Biome: ${biomeNames[biomes[tileX]]}`, 28, 70, '#ffffff', '14px Minecraft, monospace');
  drawText(`Depth: ${stage} +${depth}`, 28, 90, '#d9e6ff', '14px Minecraft, monospace');
  drawText('LMB mine   RMB place', 28, 110, '#8fb4d9', '12px Minecraft, monospace');
}

function getInventoryIconLayout(slotW, slotH) {
  const iconSize = slotW >= 40 ? TILE * 2 : TILE;
  return {
    size: iconSize,
    x: Math.floor((slotW - iconSize) / 2),
    y: Math.floor((slotH - iconSize) / 2),
  };
}

function drawInventorySlot(stack, x, y, slotW, slotH, options = {}) {
  const selected = !!options.selected;
  const hotkey = options.hotkey || '';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = selected ? 'rgba(46,57,82,0.92)' : 'rgba(10,12,18,0.72)';
  ctx.fillRect(x, y, slotW, slotH);
  if (selected) {
    ctx.fillStyle = 'rgba(255,213,94,0.08)';
    ctx.fillRect(x + 2, y + 2, slotW - 4, slotH - 4);
  }
  ctx.strokeStyle = selected ? '#ffef9c' : 'rgba(255,255,255,0.16)';
  ctx.strokeRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);
  if (selected) {
    ctx.strokeStyle = 'rgba(255,213,94,0.5)';
    ctx.strokeRect(x + 1.5, y + 1.5, slotW - 3, slotH - 3);
  }

  if (!isEmptyStack(stack)) {
    const icon = getInventoryIconLayout(slotW, slotH);
    if (tileTextures[stack.type]) {
      ctx.drawImage(tileTextures[stack.type], x + icon.x, y + icon.y, icon.size, icon.size);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillRect(x + icon.x, y + icon.y, icon.size, icon.size);
    }
  }

  if (hotkey) {
    drawText(hotkey, x + 5, y + 13, 'rgba(255,255,255,0.7)', '10px Minecraft, monospace');
  }
  if (stack.count > 0) {
    drawText(String(stack.count), x + slotW - 6, y + slotH - 7, '#ffffff', '12px Minecraft, monospace', 'right');
  }
  ctx.restore();
}

function drawChestUI() {
  if (!openUI || openUI.type !== 'chest') return;
  const slots = chests.get(openUI.key);
  if (!slots) return;
  const cols = 5, rows = 4, sW = 44, sH = 44, pad = 14;
  const panelW = cols * sW + pad * 2;
  const panelH = rows * sH + pad * 2 + 28;
  const px = Math.round(canvas.width / 2 - panelW / 2);
  // Position chest panel above the inventory panel with a small gap
  const invMetrics = getInventoryMetrics();
  const py = Math.max(4, invMetrics.panel.y - panelH - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
  drawText('CHEST', px + pad, py + 20, '#d4a840', '13px Minecraft, monospace');
  for (let i = 0; i < CHEST_SLOTS; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const sx = px + pad + col * sW, sy = py + pad + 20 + row * sH;
    const slotRef = getUiSlotAt(mouse.x, mouse.y);
    const hovered = slotRef?.area === 'chest' && slotRef?.index === i;
    drawInventorySlot(slots[i], sx, sy, sW, sH, { hovered });
  }
}

function drawFurnaceUI() {
  if (!openUI || openUI.type !== 'furnace') return;
  const f = furnaces.get(openUI.key);
  if (!f) return;
  const sW = 48, sH = 48, pad = 16;
  const panelW = 260, panelH = 170;
  const px = Math.round(canvas.width / 2 - panelW / 2);
  const py = Math.round(canvas.height / 2 - panelH / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
  drawText('FURNACE', px + pad, py + 22, '#ff9944', '13px Minecraft, monospace');

  // Ore slot (top-left area)
  const oreX = px + pad, oreY = py + 36;
  drawInventorySlot(f.ore, oreX, oreY, sW, sH);
  drawText('Ore', oreX + 2, oreY + sH + 14, '#aaa', '11px monospace');

  // Fuel slot (bottom-left)
  const fuelX = px + pad, fuelY = py + 100;
  drawInventorySlot(f.fuel, fuelX, fuelY, sW, sH);
  drawText('Fuel', fuelX + 2, fuelY + sH + 14, '#aaa', '11px monospace');

  // Progress bar
  const recipe = SMELT_RECIPES[f.ore.type];
  const hasFuel = !isEmptyStack(f.fuel) && f.fuel.type === COAL;
  const progress = (recipe && hasFuel) ? f.timer / recipe.time : 0;
  const barX = px + pad + sW + 12, barY = py + 60, barW = 80, barH = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH);
  if (progress > 0) {
    ctx.fillStyle = mixColor('#ff6600', '#ffcc00', progress);
    ctx.fillRect(barX, barY, Math.round(barW * progress), barH);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  drawText('▶', barX + barW / 2 - 4, barY + 11, 'rgba(255,255,255,0.5)', '10px monospace');

  // Output slot
  const outX = px + pad + sW + 12 + barW + 12, outY = py + 50;
  drawInventorySlot(f.out, outX, outY, sW, sH);
  drawText('Output', outX + 2, outY + sH + 14, '#aaa', '11px monospace');
}

function drawInventoryScreen() {
  if (!inventory.open && !openUI) return;
  if (!inventory.open) return;

  const m = getInventoryMetrics();
  const panel = m.panel;

  ctx.save();

  // Background dim
  ctx.fillStyle = 'rgba(4,7,12,0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Main panel
  drawPanel(panel.x, panel.y, panel.w, panel.h);

  // Panel header
  ctx.fillStyle = 'rgba(93,132,176,0.18)';
  ctx.fillRect(panel.x + 2, panel.y + 2, panel.w - 4, m.headerH - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(panel.x + 12, panel.y + m.headerH - 0.5);
  ctx.lineTo(panel.x + panel.w - 12, panel.y + m.headerH - 0.5);
  ctx.stroke();
  drawText('INVENTORY', panel.x + 14, panel.y + 18, '#f5f1d0', '13px Minecraft, monospace');
  drawText('TAB', panel.x + panel.w - 14, panel.y + 18, '#8fb4d9', '11px Minecraft, monospace', 'right');

  // ── EQUIPMENT SECTION ──────────────────────────────────────
  const eq = m.equip;
  drawText('ARMOR', eq.x, m.upper.y + 14, '#c9aa71', '11px Minecraft, monospace');
  for (let i = 0; i < 4; i++) {
    const rect = getSlotRect('equip', i, m);
    const labelY = rect.y + Math.floor(m.slotH * 0.58);
    drawText(EQUIP_LABELS[i], eq.x, labelY, '#6a8fba', '10px Minecraft, monospace');
    drawInventorySlot(equipment[i], rect.x, rect.y, m.slotW, m.slotH);
  }
  // ── ACCESSORIES SECTION ────────────────────────────────────
  const ac = m.acc;
  drawText('ACCESS.', ac.x, m.upper.y + 14, '#c9aa71', '11px Minecraft, monospace');
  for (let i = 0; i < ACC_SLOTS; i++) {
    const rect = getSlotRect('acc', i, m);
    const labelY = rect.y + Math.floor(m.slotH * 0.58);
    drawText(`Acc ${i + 1}`, ac.x, labelY, '#6a8fba', '10px Minecraft, monospace');
    drawInventorySlot(accessories[i], rect.x, rect.y, m.slotW, m.slotH);
  }

  // ── CRAFTING SECTION ───────────────────────────────────────
  const cr = m.craft;
  drawText('CRAFTING', cr.x, m.upper.y + 14, '#c9aa71', '11px Minecraft, monospace');

  // 3×3 grid
  for (let i = 0; i < CRAFT_SIZE; i++) {
    const rect = getSlotRect('craft', i, m);
    drawInventorySlot(craftingGrid[i], rect.x, rect.y, m.slotW, m.slotH);
  }

  // Arrow (lit when output available)
  updateCraftingOutput();
  const arrowCenterX = cr.arrowX + Math.floor(cr.arrowW / 2);
  const arrowCenterY = cr.y + Math.floor(cr.gridSize / 2);
  const hasOutput = !isEmptyStack(craftingOutput);
  ctx.fillStyle = hasOutput ? '#ffd55e' : 'rgba(255,255,255,0.22)';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▶', arrowCenterX, arrowCenterY + 6);
  ctx.textAlign = 'left';

  // Output slot
  const outRect = getSlotRect('craftout', 0, m);
  drawInventorySlot(craftingOutput, outRect.x, outRect.y, m.slotW, m.slotH, { selected: hasOutput });
  if (hasOutput) {
    drawText('CRAFT', outRect.x + Math.floor(m.slotW / 2), outRect.y - 5, '#c9aa71', '9px Minecraft, monospace', 'center');
  }

  // ── DIVIDER ────────────────────────────────────────────────
  const divY = m.backpack.y - 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(panel.x + 12, divY);
  ctx.lineTo(panel.x + panel.w - 12, divY);
  ctx.stroke();

  // ── BACKPACK SECTION ───────────────────────────────────────
  const bp = m.backpack;
  drawText('BACKPACK', bp.labelX, bp.labelY, '#f5f1d0', '13px Minecraft, monospace');
  for (let i = 0; i < BACKPACK_SIZE; i++) {
    const rect = getSlotRect('backpack', i, m);
    drawInventorySlot(inventory.backpack[i], rect.x, rect.y, m.slotW, m.slotH);
  }

  // Chest UI drawn on top of inventory when a chest is open
  if (openUI?.type === 'chest') drawChestUI();
  if (openUI?.type === 'furnace') drawFurnaceUI();

  ctx.restore();
}

function drawInventoryTooltip() {
  if (dragState.active) return;
  const slotRef = getUiSlotAt(mouse.x, mouse.y);
  if (!slotRef) return;
  const slot = getInventorySlot(slotRef.area, slotRef.index);
  if (!slot || slot.type === AIR || slot.type === 0) return;
  const name = getItemName(slot.type);
  if (!name || name === 'Item') return;
  const text = name.toUpperCase();
  ctx.font = '11px Minecraft, monospace';
  const tw = ctx.measureText(text).width;
  const pad = 6;
  const tx = Math.min(mouse.x + 14, canvas.width - tw - pad * 2 - 4);
  const ty = Math.max(mouse.y - 28, 4);
  ctx.fillStyle = 'rgba(8,12,22,0.92)';
  ctx.strokeStyle = 'rgba(180,140,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw + pad * 2, 22, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5f1d0';
  ctx.textAlign = 'left';
  ctx.fillText(text, tx + pad, ty + 15);
}

function drawHotbar() {
  const metrics = getInventoryMetrics();
  const selected = inventory.hotbar[inventory.selected];

  for (let i = 0; i < inventory.hotbar.length; i++) {
    const rect = getSlotRect('hotbar', i, metrics);
    const slot = inventory.hotbar[i];
    drawInventorySlot(slot, rect.x, rect.y, rect.w, rect.h, {
      selected: i === inventory.selected,
      hotkey: String(i + 1),
    });
  }

  if (selected && selected.type !== AIR) {
    const label = getItemName(selected.type);
    drawText(label.toUpperCase(), Math.floor(canvas.width / 2), metrics.hotbar.y - 10, '#f5f1d0', '14px Minecraft, monospace', 'center');
  }
}

function drawDraggedStack() {
  if (!dragState.active || isEmptyStack(dragState.item)) return;
  const metrics = getInventoryMetrics();
  const x = Math.floor(mouse.x - metrics.slotW * 0.35);
  const y = Math.floor(mouse.y - metrics.slotH * 0.4);
  drawInventorySlot(dragState.item, x, y, metrics.slotW, metrics.slotH, { selected: true });
}

// ─── SAVE / LOAD ─────────────────────────────────────────────────────────────

function encodeUint8Array(arr) {
  const CHUNK = 8192;
  let result = '';
  for (let i = 0; i < arr.length; i += CHUNK) {
    result += String.fromCharCode.apply(null, arr.subarray(i, Math.min(arr.length, i + CHUNK)));
  }
  return btoa(result);
}

function decodeUint8Array(b64, target) {
  const bin = atob(b64);
  const len = Math.min(bin.length, target.length);
  for (let i = 0; i < len; i++) target[i] = bin.charCodeAt(i);
}

function encodeWaterSparse() {
  const e = [];
  for (let i = 0; i < water.length; i++) {
    if (water[i] > 0.001) e.push(i, Math.round(water[i] * 10000) / 10000);
  }
  return e;
}

function decodeWaterSparse(e) {
  water.fill(0);
  for (let i = 0; i < e.length; i += 2) water[e[i]] = e[i + 1];
}

function stackToObj(s) { return { t: s.type, c: s.count }; }
function objToStack(o) { return createStack(o?.t ?? AIR, o?.c ?? 0); }

function getSaveMetadata(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return (d?.v === 1 || d?.v === 2) ? { savedAt: d.savedAt } : null;
  } catch { return null; }
}

function serializeGame() {
  const chestsArr = [];
  for (const [key, slots] of chests) chestsArr.push({ key, slots: slots.map(stackToObj) });
  const furnacesArr = [];
  for (const [key, f] of furnaces) furnacesArr.push({ key, ore: stackToObj(f.ore), fuel: stackToObj(f.fuel), out: stackToObj(f.out), timer: f.timer });
  return JSON.stringify({
    v: 2,
    savedAt: Date.now(),
    world: encodeUint8Array(world),
    surfaceYs: Array.from(surfaceYs),
    biomes: Array.from(biomes),
    water: encodeWaterSparse(),
    treeCanopies: treeCanopies.map(c => ({ x: c.x, ty: c.trunkTopY, by: c.trunkBaseY, r: c.radius, b: c.biome })),
    player: { x: player.x, y: player.y, vy: player.vy, health: player.health, maxHealth: player.maxHealth, facing: player.facing },
    inv: { hotbar: inventory.hotbar.map(stackToObj), backpack: inventory.backpack.map(stackToObj), selected: inventory.selected },
    equip: equipment.map(stackToObj),
    acc: accessories.map(stackToObj),
    cam: { x: cam.x, y: cam.y },
    dayClockMs,
    chests: chestsArr,
    furnaces: furnacesArr,
  });
}

function deserializeGame(json) {
  const d = JSON.parse(json);
  if (!d || (d.v !== 1 && d.v !== 2)) return false;

  decodeUint8Array(d.world, world);
  surfaceYs.set(d.surfaceYs);
  biomes.set(d.biomes);
  decodeWaterSparse(d.water);
  treeCanopies.length = 0;
  for (const c of d.treeCanopies) {
    treeCanopies.push({ x: c.x, trunkTopY: c.ty, trunkBaseY: c.by, radius: c.r, biome: c.b });
  }

  Object.assign(player, {
    x: d.player.x, y: d.player.y, vy: d.player.vy,
    health: d.player.health, maxHealth: d.player.maxHealth, facing: d.player.facing,
    onGround: false, blockedX: false, inWater: false, fullySubmerged: false,
    drownTick: 0, jumpLatch: false, jumpAnimRestart: false, waterExitFrames: 0,
    air: PLAYER_MAX_AIR, animState: 'stand', animFrame: 0, animTick: 0,
  });

  inventory.hotbar = d.inv.hotbar.map(objToStack);
  inventory.backpack = d.inv.backpack.map(objToStack);
  inventory.selected = d.inv.selected;
  inventory.open = false;
  for (let i = 0; i < 4; i++) equipment[i] = objToStack(d.equip[i]);
  if (d.acc) for (let i = 0; i < ACC_SLOTS; i++) accessories[i] = objToStack(d.acc[i] ?? {});

  cam.x = d.cam.x;
  cam.y = d.cam.y;
  dayClockMs = d.dayClockMs;

  chests.clear();
  if (d.chests) {
    for (const entry of d.chests) {
      chests.set(entry.key, entry.slots.map(objToStack));
    }
  }
  furnaces.clear();
  if (d.furnaces) {
    for (const entry of d.furnaces) {
      furnaces.set(entry.key, { ore: objToStack(entry.ore), fuel: objToStack(entry.fuel), out: objToStack(entry.out), timer: entry.timer });
    }
  }
  openUI = null;
  return true;
}

function saveGame() {
  if (currentSaveSlot < 0) return;
  localStorage.setItem(SAVE_KEY_PREFIX + currentSaveSlot, serializeGame());
  saveMessageTimer = 150;
}

function loadGame(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
    if (!raw) return false;
    if (!deserializeGame(raw)) return false;
    buildSkyDecor();
    currentSaveSlot = slot;
    return true;
  } catch (e) {
    console.error('[terraria] load failed:', e);
    return false;
  }
}

function resetPlayer() {
  player.x = WORLD_PX / 2 - player.w / 2;
  player.y = findSpawnY();
  player.vy = 0; player.health = 5; player.maxHealth = 5; player.iframes = 0;
  player.dying = false; player.deathFrame = 0; player.deathTick = 0;
  player.onGround = false; player.blockedX = false;
  player.inWater = false; player.fullySubmerged = false;
  player.air = PLAYER_MAX_AIR; player.drownTick = 0;
  player.jumpLatch = false; player.jumpAnimRestart = false;
  player.waterExitFrames = 0; player.facing = 1;
  player.animState = 'stand'; player.animFrame = 0; player.animTick = 0;
  cam.x = clamp(player.x + player.w / 2 - canvas.width / 2, 0, Math.max(0, WORLD_PX - canvas.width));
  cam.y = clamp(player.y + player.h / 2 - canvas.height * 0.4, 0, Math.max(0, WORLD_H * TILE - canvas.height));
}

function respawnPlayer() {
  player.x = WORLD_PX / 2 - player.w / 2;
  player.y = findSpawnY();
  player.vy = 0; player.health = player.maxHealth;
  player.dying = false; player.deathFrame = 0; player.deathTick = 0;
  player.onGround = false; player.iframes = 60;
  player.inWater = false; player.fullySubmerged = false;
  player.air = PLAYER_MAX_AIR; player.drownTick = 0;
  player.jumpLatch = false; player.jumpAnimRestart = false;
  player.waterExitFrames = 0;
  cam.x = clamp(player.x + player.w / 2 - canvas.width / 2, 0, Math.max(0, WORLD_PX - canvas.width));
  cam.y = clamp(player.y + player.h / 2 - canvas.height * 0.4, 0, Math.max(0, WORLD_H * TILE - canvas.height));
}

function resetInventory() {
  for (const s of inventory.hotbar) setStack(s, createStack());
  for (const s of inventory.backpack) setStack(s, createStack());
  inventory.selected = 0; inventory.open = false;
  for (let i = 0; i < 4; i++) setStack(equipment[i], createStack());
  for (let i = 0; i < CRAFT_SIZE; i++) setStack(craftingGrid[i], createStack());
  craftingOutput = createStack();
  furnaces.clear(); openUI = null;
  slimes.length = 0;
  for (let i = 0; i < ACC_SLOTS; i++) setStack(accessories[i], createStack());
}

function startNewGame(slot) {
  currentSaveSlot = slot;
  generateWorld();
  buildSkyDecor();
  resetPlayer();
  resetInventory();
  // Starter items
  inventory.hotbar[0] = createStack(SWORD_COPPER, 1);
  inventory.hotbar[1] = createStack(PICK_COPPER, 1);
  inventory.hotbar[2] = createStack(AXE_COPPER, 1);
  setGameState('playing');
  menuConfirm = null;
}

function enterGame(slot) {
  if (loadGame(slot)) { setGameState('playing'); menuConfirm = null; }
  else startNewGame(slot);
}

function handleEscape() {
  if (gameState === 'mainmenu') return;
  if (menuConfirm) { menuConfirm = null; return; }
  if (openUI) {
    const wasOpen = openUI.wasInventoryOpen ?? true;
    openUI = null;
    if (!wasOpen) toggleInventory(false);
    return;
  }
  if (inventory.open) { toggleInventory(false); return; }
  if (gameState === 'playing') { setGameState('paused'); }
  else if (gameState === 'paused') { setGameState('playing'); }
}

// ─── MENUS ────────────────────────────────────────────────────────────────────

function menuSlotLayout() {
  const panelW = Math.min(460, canvas.width - 40);
  const slotH = 58;
  const slotGap = 10;
  const audioSectionH = audioManager ? 90 : 0;
  const creditH = 22;
  const footerPad = 22;
  const panelH = 88 + 3 * slotH + 2 * slotGap + 18 + audioSectionH + creditH + footerPad;
  const panelX = Math.floor((canvas.width - panelW) / 2);
  const panelY = Math.floor((canvas.height - panelH) / 2);
  const firstSlotY = panelY + 88;
  const audioY = firstSlotY + 3 * (slotH + slotGap) + 16;
  const creditY = audioY + audioSectionH + 18;
  return {
    panelX, panelY, panelW, panelH,
    slotH, slotGap,
    slotW: panelW - 48,
    slotX: panelX + 24,
    firstSlotY,
    audioSectionH,
    audioY,
    creditY,
  };
}

function pauseMenuLayout() {
  const btns = menuConfirm === 'newworld' ? 2 : 4;
  const panelW = Math.min(380, canvas.width - 40);
  const btnH = 46; const btnGap = 10;
  const innerH = btns * btnH + (btns - 1) * btnGap;
  const audioSectionH = !menuConfirm && audioManager ? 90 : 0;
  const panelH = 62 + innerH + 18 + audioSectionH + (audioSectionH ? 18 : 0);
  const panelX = Math.floor((canvas.width - panelW) / 2);
  const panelY = Math.floor((canvas.height - panelH) / 2);
  const firstBtnY = panelY + 58;
  const audioY = firstBtnY + innerH + 18;
  return {
    panelX, panelY, panelW, panelH,
    btnH, btnGap,
    btnW: panelW - 40,
    btnX: panelX + 20,
    firstBtnY,
    audioSectionH,
    audioY,
  };
}

function getAudioSliderValue(key) {
  if (!audioManager) return 0;
  if (key === 'master') return audioManager.getMasterVolume();
  if (key === 'music') return audioManager.getMusicVolume();
  return 0;
}

function setAudioSliderValue(key, value) {
  if (!audioManager) return;
  const next = clamp(value, 0, 1);
  if (key === 'master') audioManager.setMasterVolume(next);
  else if (key === 'music') audioManager.setMusicVolume(next);
}

function buildAudioSliders(panelX, panelW, sectionY) {
  if (!audioManager) return [];
  const sliderX = panelX + 24;
  const sliderW = panelW - 48;
  return [
    { key: 'master', label: 'MASTER VOLUME', x: sliderX, y: sectionY + 18, w: sliderW, h: 12 },
    { key: 'music', label: 'MUSIC VOLUME', x: sliderX, y: sectionY + 50, w: sliderW, h: 12 },
  ];
}

function getVisibleAudioSliders() {
  if (!audioManager) return [];
  if (gameState === 'mainmenu') {
    const L = menuSlotLayout();
    return buildAudioSliders(L.panelX, L.panelW, L.audioY);
  }
  if (gameState === 'paused' && !menuConfirm) {
    const L = pauseMenuLayout();
    return buildAudioSliders(L.panelX, L.panelW, L.audioY);
  }
  return [];
}

function updateAudioSliderFromPointer(slider, pointerX) {
  if (!slider) return;
  const ratio = (pointerX - slider.x) / slider.w;
  setAudioSliderValue(slider.key, ratio);
}

function handleMenuAudioPointerDown(x, y) {
  const sliders = getVisibleAudioSliders();
  for (const slider of sliders) {
    if (!isPointInRect(x, y, slider.x, slider.y - 8, slider.w, slider.h + 18)) continue;
    audioUi.draggingKey = slider.key;
    updateAudioSliderFromPointer(slider, x);
    return true;
  }
  return false;
}

function updateMenuAudioDrag(x) {
  if (!audioUi.draggingKey) return;
  const slider = getVisibleAudioSliders().find(entry => entry.key === audioUi.draggingKey);
  if (!slider) {
    audioUi.draggingKey = null;
    return;
  }
  updateAudioSliderFromPointer(slider, x);
}

function clearMenuAudioDrag() {
  audioUi.draggingKey = null;
}

function drawMenuAudioSection(panelX, panelW, sectionY, title = 'AUDIO') {
  const sliders = buildAudioSliders(panelX, panelW, sectionY);
  if (!sliders.length) return;

  drawText(title, panelX + panelW / 2, sectionY, 'rgba(255,255,255,0.38)', '10px Minecraft, monospace', 'center');

  for (const slider of sliders) {
    const value = getAudioSliderValue(slider.key);
    const hovering = audioUi.draggingKey === slider.key
      || isPointInRect(mouse.x, mouse.y, slider.x, slider.y - 8, slider.w, slider.h + 18);
    drawText(slider.label, slider.x, slider.y - 6, '#d9e7f8', '10px Minecraft, monospace');
    drawText(`${Math.round(value * 100)}%`, slider.x + slider.w, slider.y - 6,
      hovering ? '#ffd55e' : 'rgba(255,255,255,0.62)', '10px Minecraft, monospace', 'right');

    ctx.fillStyle = 'rgba(4,8,14,0.92)';
    ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
    ctx.strokeStyle = hovering ? 'rgba(120,185,240,0.95)' : 'rgba(255,255,255,0.18)';
    ctx.strokeRect(slider.x + 0.5, slider.y + 0.5, slider.w - 1, slider.h - 1);

    const fillW = Math.round((slider.w - 2) * value);
    if (fillW > 0) {
      ctx.fillStyle = hovering ? 'rgba(104,184,255,0.82)' : 'rgba(86,140,208,0.66)';
      ctx.fillRect(slider.x + 1, slider.y + 1, fillW, slider.h - 2);
    }

    const knobX = Math.round(slider.x + slider.w * value);
    ctx.fillStyle = hovering ? '#ffd55e' : '#f5f1d0';
    ctx.fillRect(knobX - 3, slider.y - 2, 6, slider.h + 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeRect(knobX - 3.5, slider.y - 1.5, 6, slider.h + 4);
  }
}

function drawMainMenu() {
  drawSky();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const L = menuSlotLayout();
  drawPanel(L.panelX, L.panelY, L.panelW, L.panelH);

  // Header tint
  ctx.fillStyle = 'rgba(40,60,90,0.4)';
  ctx.fillRect(L.panelX + 2, L.panelY + 2, L.panelW - 4, 80);

  drawText('TERRARIA', L.panelX + L.panelW / 2, L.panelY + 36, '#ffd55e', '28px Minecraft, monospace', 'center');
  drawText('Eve Net Edition', L.panelX + L.panelW / 2, L.panelY + 58, '#7aacde', '11px Minecraft, monospace', 'center');
  drawText('Select World', L.panelX + L.panelW / 2, L.panelY + 74, 'rgba(255,255,255,0.35)', '10px Minecraft, monospace', 'center');

  for (let i = 0; i < 3; i++) {
    const by = L.firstSlotY + i * (L.slotH + L.slotGap);
    const meta = getSaveMetadata(i);
    const hov = isPointInRect(mouse.x, mouse.y, L.slotX, by, L.slotW, L.slotH);
    ctx.fillStyle = hov ? 'rgba(50,80,120,0.85)' : 'rgba(8,12,20,0.8)';
    ctx.fillRect(L.slotX, by, L.slotW, L.slotH);
    ctx.strokeStyle = hov ? 'rgba(100,160,220,0.9)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.slotX + 0.5, by + 0.5, L.slotW - 1, L.slotH - 1);

    drawText(`World ${i + 1}`, L.slotX + 16, by + 20, '#f5f1d0', '13px Minecraft, monospace');
    if (meta) {
      const d = new Date(meta.savedAt);
      const ds = d.toLocaleDateString() + '  ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      drawText('CONTINUE', L.slotX + L.slotW - 16, by + 20, '#ffd55e', '12px Minecraft, monospace', 'right');
      drawText(ds, L.slotX + 16, by + 40, 'rgba(150,195,245,0.8)', '10px Minecraft, monospace');
    } else {
      drawText('NEW WORLD', L.slotX + L.slotW - 16, by + 20, 'rgba(255,255,255,0.4)', '12px Minecraft, monospace', 'right');
      drawText('─── empty ───', L.slotX + 16, by + 40, 'rgba(255,255,255,0.2)', '11px Minecraft, monospace');
    }
  }
  drawMenuAudioSection(L.panelX, L.panelW, L.audioY);
  drawText('Music by Alex McCulloch', L.panelX + L.panelW / 2, L.creditY, '#9bc9ef', '12px Minecraft, monospace', 'center');
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const L = pauseMenuLayout();
  drawPanel(L.panelX, L.panelY, L.panelW, L.panelH);
  ctx.fillStyle = 'rgba(40,60,90,0.35)';
  ctx.fillRect(L.panelX + 2, L.panelY + 2, L.panelW - 4, 50);

  const title = menuConfirm === 'newworld' ? 'NEW WORLD?' : 'PAUSED';
  const titleColor = menuConfirm === 'newworld' ? '#ff9966' : '#ffd55e';
  drawText(title, L.panelX + L.panelW / 2, L.panelY + 34, titleColor, '18px Minecraft, monospace', 'center');

  if (menuConfirm === 'newworld') {
    drawText('Unsaved progress will be lost.', L.panelX + L.panelW / 2, L.panelY + 54, 'rgba(255,200,160,0.8)', '10px Minecraft, monospace', 'center');
  }

  const labels = menuConfirm === 'newworld'
    ? ['CANCEL', 'CONFIRM']
    : ['RESUME', 'SAVE GAME', 'RESET WORLD', 'MAIN MENU'];
  const colors = menuConfirm === 'newworld'
    ? ['#f5f1d0', '#ff7a7a']
    : ['#f5f1d0', '#f5f1d0', '#ff9966', '#ff7a7a'];

  for (let i = 0; i < labels.length; i++) {
    const by = L.firstBtnY + i * (L.btnH + L.btnGap);
    const hov = isPointInRect(mouse.x, mouse.y, L.btnX, by, L.btnW, L.btnH);
    const isRed = colors[i] === '#ff7a7a' || colors[i] === '#ff9966';
    ctx.fillStyle = hov
      ? (isRed ? 'rgba(140,40,40,0.7)' : 'rgba(50,80,120,0.85)')
      : 'rgba(8,12,20,0.8)';
    ctx.fillRect(L.btnX, by, L.btnW, L.btnH);
    ctx.strokeStyle = hov
      ? (isRed ? 'rgba(220,80,80,0.9)' : 'rgba(100,160,220,0.9)')
      : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.btnX + 0.5, by + 0.5, L.btnW - 1, L.btnH - 1);
    drawText(labels[i], L.btnX + L.btnW / 2, by + L.btnH / 2 + 5, colors[i], '13px Minecraft, monospace', 'center');

    // Save confirmation
    if (labels[i] === 'SAVE GAME' && saveMessageTimer > 0) {
      drawText('✓ SAVED!', L.btnX + L.btnW - 12, by + L.btnH / 2 + 5, '#7dff7a', '11px Minecraft, monospace', 'right');
    }
  }
  if (!menuConfirm) drawMenuAudioSection(L.panelX, L.panelW, L.audioY);
}

function handleMenuClick(x, y) {
  if (gameState === 'mainmenu') {
    const L = menuSlotLayout();
    for (let i = 0; i < 3; i++) {
      const by = L.firstSlotY + i * (L.slotH + L.slotGap);
      if (isPointInRect(x, y, L.slotX, by, L.slotW, L.slotH)) {
        enterGame(i);
        return;
      }
    }
  } else if (gameState === 'paused') {
    const L = pauseMenuLayout();
    if (menuConfirm === 'newworld') {
      const labels = ['CANCEL', 'CONFIRM'];
      for (let i = 0; i < 2; i++) {
        const by = L.firstBtnY + i * (L.btnH + L.btnGap);
        if (isPointInRect(x, y, L.btnX, by, L.btnW, L.btnH)) {
          if (i === 0) menuConfirm = null;
          else startNewGame(currentSaveSlot);
          return;
        }
      }
    } else {
      const actions = [
        () => { setGameState('playing'); },
        () => { saveGame(); },
        () => { menuConfirm = 'newworld'; },
        () => { if (dragState.active) returnDraggedStack(); inventory.open = false; setGameState('mainmenu'); },
      ];
      for (let i = 0; i < 4; i++) {
        const by = L.firstBtnY + i * (L.btnH + L.btnGap);
        if (isPointInRect(x, y, L.btnX, by, L.btnW, L.btnH)) {
          actions[i]();
          return;
        }
      }
    }
  }
}

function loop(ts) {
  const dt = ts ? Math.min(ts - lastTime, TARGET_DT * 3) : TARGET_DT;
  lastTime = ts || 0;
  const scale = dt / TARGET_DT;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Main Menu ──────────────────────────────────────────────
  if (gameState === 'mainmenu') {
    updateWorld(dt);
    drawMainMenu();
    requestAnimationFrame(loop);
    return;
  }

  // ── Pause Menu ─────────────────────────────────────────────
  if (gameState === 'paused') {
    if (saveMessageTimer > 0) saveMessageTimer--;
    drawSky();
    drawWorld();
    drawWater();
    drawTreeCanopies();
    drawPlayer();
    drawArrows();
    drawSlimes();
    drawPauseMenu();
    requestAnimationFrame(loop);
    return;
  }

  // ── Playing ────────────────────────────────────────────────
  if (saveMessageTimer > 0) saveMessageTimer--;
  updateWorld(dt);
  updatePlayer(scale);
  if (player.health <= 0 && !player.dying) {
    player.dying = true;
    player.deathFrame = 0;
    player.deathTick = 0;
    mouse.down = false;
    mouse.rightDown = false;
  }
  updateDeathAnim(scale);
  // Accessory: Band of Regeneration — 1 HP every 600 ticks (~10s)
  if (hasAccessory(ACC_BAND_REGEN) && !player.dying) {
    player.regenTick = (player.regenTick || 0) + scale;
    if (player.regenTick >= 600) {
      player.regenTick = 0;
      const cap = getMaxHealth();
      if (player.health < cap) player.health = Math.min(cap, player.health + 1);
    }
  } else { player.regenTick = 0; }
  if (!player.dying) updateMining(scale);
  if (!player.dying) updatePlacement(lastTime);
  if (!player.dying) updateAnimation(scale);
  updateCamera(scale);

  drawSky();
  drawWorld();
  drawWater();
  drawTreeCanopies();
  drawPlayer();
  drawArrows();
  drawSlimes();
  if (player.fullySubmerged) {
    ctx.fillStyle = 'rgba(24,72,138,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawMining();
  drawInventoryScreen();
  drawStatusHud();
  drawHotbar();
  drawDraggedStack();
  drawInventoryTooltip();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
