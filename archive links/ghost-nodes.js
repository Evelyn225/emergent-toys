// Draw network routes and animate packets
function drawRoutes() {
  // Draw all route lines
  routes.forEach(route => {
    let points = route.points || [route.from, ...route.hops, route.to];
    strokeWeight(2);
    stroke(255, 60);
    noFill();
    beginShape();
    points.forEach(pt => vertex(pt.x, pt.y));
    endShape();

  });
  // Animate packets
  let now = millis();
  packets.forEach(packet => {
    let route = routes[packet.routeIdx];
    if (!route) return;
    let points = route.points;
    if (!points) return;
    if (packet.stopped || packet.fade <= 0) return;
    // ...existing code...
    push();
    if (packet.lost) {
      fill(255, 40, 40, 180 * packet.fade);
      stroke(255, 40, 40, 120 * packet.fade);
    } else {
      fill(255, 180);
      stroke(255, 120);
    }
    ellipse(packet.x, packet.y, 8, 8);
    pop();
  });
}
// Minimal, smooth, black and white ghost nodes visualization
// Realistic traffic pattern: burst and idle
let trafficBurst = false;
let burstEndTime = 0;
let idleEndTime = 0;

function updateTrafficPattern() {
  let now = millis();
  if (trafficBurst && now > burstEndTime) {
    trafficBurst = false;
    idleEndTime = now + random(2000, 6000);
  } else if (!trafficBurst && now > idleEndTime) {
    trafficBurst = true;
    burstEndTime = now + random(1200, 3500);
  }
}

function shouldGeneratePacket() {
  updateTrafficPattern();
  // During burst, high chance; during idle, low chance
  if (trafficBurst) return Math.random() < 0.25;
  return Math.random() < 0.03;
}
// Three routers, seven virtual access points, animated routes


const ROUTER_COUNT = 5;
const VAP_COUNT = 16;
const SSID_CHANGE_INTERVAL = 9000; // ms
const TRACERT_HOPS = 8;


let routers = [];
let vaps = [];
let allNodes = [];
let edges = [];
let routes = [];
let packets = [];
let recentPaths = [];
let stats = {
  sent: 0,
  delivered: 0,
  lost: 0,
  avgLatency: 0
};
let lastEventTime = 0;
let EVENT_INTERVAL = 32000; // ms
  // Draw fading lines for recent packet paths
  recentPaths = recentPaths.filter(p => millis() - p.time < 2200);
  recentPaths.forEach(p => {
    let alpha = map(millis() - p.time, 0, 2200, 180, 0);
    stroke(p.color[0], p.color[1], p.color[2], alpha);
    strokeWeight(2);
    noFill();
    beginShape();
    p.path.forEach(pt => vertex(pt.x, pt.y));
    endShape();
  });
let ssid = '';
let lastSSIDChange = 0;

function randomIP() {
  return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
}

function randomSSID() {
  const words = [
    'Ghost', 'Phantom', 'Echo', 'Null', 'Lost', 'Signal', 'Cascade', 'Relay', 'Mesh', 'Chorus',
    'Static', 'Amber', 'Harmonic', 'Resonance', 'Drift', 'Fox', 'Loom', 'Threshold', 'Archive', 'Periphery',
    'Fragment', 'Graveyard', 'Chamber', 'Topology', 'Anomaly', 'Protocol', 'Weave', 'Cache', 'Collective', 'Garden'
  ];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 10000);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}


// Only generate node positions once
let nodePositionsInitialized = false;




// Bridson's Poisson disk sampling for 2D
function poissonDiskSample(width, height, minDist, maxPoints, margin) {
  let k = 30;
  let cellSize = minDist / Math.SQRT2;
  let gridWidth = Math.ceil((width - 2 * margin) / cellSize);
  let gridHeight = Math.ceil((height - 2 * margin) / cellSize);
  let grid = Array(gridWidth * gridHeight).fill(null);
  let samples = [];
  let active = [];

  function gridIdx(x, y) {
    let gx = Math.floor((x - margin) / cellSize);
    let gy = Math.floor((y - margin) / cellSize);
    return gy * gridWidth + gx;
  }

  function isFarEnough(x, y) {
    let gx = Math.floor((x - margin) / cellSize);
    let gy = Math.floor((y - margin) / cellSize);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        let nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
        let idx = ny * gridWidth + nx;
        let s = grid[idx];
        if (s && dist(x, y, s.x, s.y) < minDist) return false;
      }
    }
    return true;
  }

  // Start with a random point
  let x0 = random(margin, width - margin);
  let y0 = random(margin, height - margin);
  let first = { x: x0, y: y0 };
  samples.push(first);
  active.push(first);
  grid[gridIdx(x0, y0)] = first;

  while (active.length && samples.length < maxPoints) {
    let idx = Math.floor(random(active.length));
    let s = active[idx];
    let found = false;
    for (let n = 0; n < k; n++) {
      let a = random(TWO_PI);
      let m = random(minDist, 2 * minDist);
      let nx = s.x + cos(a) * m;
      let ny = s.y + sin(a) * m;
      if (nx < margin || nx > width - margin || ny < margin || ny > height - margin) continue;
      if (isFarEnough(nx, ny)) {
        let pt = { x: nx, y: ny };
        samples.push(pt);
        active.push(pt);
        grid[gridIdx(nx, ny)] = pt;
        found = true;
        break;
      }
    }
    if (!found) active.splice(idx, 1);
  }
  return samples;
}



function initializeNodes() {
    // Failsafe: ensure vaps and allNodes never exceed VAP_COUNT
    if (vaps.length > VAP_COUNT) {
      vaps.length = VAP_COUNT;
    }
    // Remove any extra vaps from allNodes as well
    let vapNodeCount = 0;
    allNodes = allNodes.filter(n => {
      if (n.type === 'vap') {
        vapNodeCount++;
        return vapNodeCount <= VAP_COUNT;
      }
      return true;
    });
  let margin = 140;
  let minDist = 180;
  let total = ROUTER_COUNT + VAP_COUNT;
  routers = [];
  vaps = [];
  allNodes = [];

  let points = [];
  let relax = 0;
  let minMinDist = 60;
  // Try to get enough points, reduce minDist if needed
  while (points.length < total && minDist > minMinDist) {
    points = poissonDiskSample(width, height, minDist, total, margin);
    if (points.length < total) {
      minDist *= 0.92;
      relax++;
    }
  }
  // Filter to unique points only (no duplicate x/y)
  let uniquePoints = [];
  let seen = new Map();
  let duplicates = [];
  for (let i = 0; i < points.length; i++) {
    let pt = points[i];
    let key = pt.x.toFixed(6) + ',' + pt.y.toFixed(6);
    if (!seen.has(key)) {
      uniquePoints.push(pt);
      seen.set(key, i);
    } else {
      duplicates.push({key, first: seen.get(key), dup: i});
    }
  }
  if (duplicates.length > 0) {
    console.warn(`Duplicate node positions detected:`, duplicates);
  }
  if (uniquePoints.length < total) {
    console.warn(`Could only place ${uniquePoints.length} unique nodes (wanted ${total}) with minDist=${minDist.toFixed(1)}. Reducing node count.`);
  }
  // Log all assigned node positions for debugging
  console.log('Assigned node positions:', uniquePoints.map(pt => ({x: pt.x, y: pt.y})));
  // Only assign as many nodes as we have unique points
  let nodeCount = Math.min(uniquePoints.length, total);
  shuffle(uniquePoints, true);
  // Place routers first
  let routerPoints = uniquePoints.slice(0, Math.min(ROUTER_COUNT, nodeCount));
  let vapPoints = [];
  // For VAPs, skip points too close to any router (with strict epsilon check)
  let routerExclusion = minDist * 0.95;
  const EPSILON = 1e-3;
  for (let i = Math.min(ROUTER_COUNT, nodeCount); i < uniquePoints.length && vapPoints.length < VAP_COUNT; i++) {
    let pt = uniquePoints[i];
    let tooClose = false;
    for (let r of routerPoints) {
      if (dist(pt.x, pt.y, r.x, r.y) < routerExclusion || (Math.abs(pt.x - r.x) < EPSILON && Math.abs(pt.y - r.y) < EPSILON)) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) vapPoints.push(pt);
  }
  // If not enough VAPs, relax exclusion, but NEVER allow overlap with routers (strict epsilon check)
  if (vapPoints.length < VAP_COUNT) {
    for (let i = Math.min(ROUTER_COUNT, nodeCount); i < uniquePoints.length && vapPoints.length < VAP_COUNT; i++) {
      let pt = uniquePoints[i];
      let isRouter = routerPoints.some(rpt => Math.abs(rpt.x - pt.x) < EPSILON && Math.abs(rpt.y - pt.y) < EPSILON);
      if (!vapPoints.includes(pt) && !isRouter) {
        vapPoints.push(pt);
      } else if (isRouter) {
        console.warn('[VAP PLACEMENT WARNING] Attempted to place VAP at router position:', pt);
      }
    }
  }
  // Assign routers and vaps, ensuring no duplicate nodes in allNodes
  routers.length = 0;
  vaps.length = 0;
  allNodes.length = 0;
  const usedPoints = new Set();
  routerPoints.forEach((pt, i) => {
    const key = pt.x.toFixed(6) + ',' + pt.y.toFixed(6);
    if (!usedPoints.has(key)) {
      let router = { x: pt.x, y: pt.y, ip: randomIP(), type: 'router', idx: i };
      routers.push(router);
      allNodes.push(router);
      usedPoints.add(key);
    }
  });
  // Ensure we never create more VAPs than VAP_COUNT
  let vapsAdded = 0;
  for (let i = 0; i < vapPoints.length && vapsAdded < VAP_COUNT; i++) {
    const pt = vapPoints[i];
    const key = pt.x.toFixed(6) + ',' + pt.y.toFixed(6);
    if (!usedPoints.has(key)) {
      let vap = { x: pt.x, y: pt.y, ip: randomIP(), type: 'vap', idx: routers.length + vaps.length };
      vaps.push(vap);
      allNodes.push(vap);
      usedPoints.add(key);
      vapsAdded++;
    }
  }
  nodePositionsInitialized = true;
  console.log(`Placed ${routers.length} routers and ${vaps.length} VAPs (minDist=${minDist.toFixed(1)})`);
}
// Periodic cleanup of routes and packets (every 20 seconds)

let lastCleanup = 0;
const CLEANUP_INTERVAL = 20000;
function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  textFont('Segoe UI, Arial, sans-serif');
  textAlign(CENTER, CENTER);
  initializeNodes();
  generateEdges();
  ssid = randomSSID();
  lastSSIDChange = millis();
  lastRouteChange = millis();
  generateRoutes();
}


function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  nodePositionsInitialized = false;
  initializeNodes();
  generateEdges();
  ssid = randomSSID();
  lastSSIDChange = millis();
  lastRouteChange = millis();
  generateRoutes();
}

function drawMesh() {
  stroke(255, 10);
  strokeWeight(1);
  edges.forEach(e => {
    let a = allNodes[e.from];
    let b = allNodes[e.to];
    line(a.x, a.y, b.x, b.y);
  });
}

// Draw a dithered circle for ghostly node effect
function drawDitheredCircle(x, y, r, dark, light, phase, density = 0.42) {
  let step = 4;
  let rr = r / 2;
  for (let dx = -rr; dx <= rr; dx += step) {
    for (let dy = -rr; dy <= rr; dy += step) {
      let dist2 = dx * dx + dy * dy;
      if (dist2 <= rr * rr) {
        // Dither pattern: checkerboard with phase
        let px = Math.floor((dx + rr) / step);
        let py = Math.floor((dy + rr) / step);
        let dither = ((px + py + phase) % 1 === 0);
        let alpha = dither ? 120 : 40;
        let c = dither ? light : dark;
        fill(c[0], c[1], c[2], alpha);
        noStroke();
        ellipse(x + dx, y + dy, step * density, step * density);
      }
    }
  }
}

function drawNodes() {

  let t = Math.floor(millis() / 300) % 2; // animate dither phase
  routers.forEach((r, i) => {
    push();
    // Dithered fill
    drawDitheredCircle(r.x, r.y, 44, [60,60,60], [255,255,255], t + i % 2, 0.32);
    stroke(255, 180);
    strokeWeight(2.5);
    noFill();
    ellipse(r.x, r.y, 44, 44);
    noStroke();
    fill(255, 220);
    textSize(13);
    text(r.ip, r.x, r.y + 24);
    pop();
    // ...pulse effect removed...
  });
  vaps.forEach((v, i) => {
    push();
    // Dithered fill
    drawDitheredCircle(v.x, v.y, 22, [40,40,40], [200,200,200], t + i % 2, 0.28);
    stroke(255, 80);
    strokeWeight(1.2);
    noFill();
    ellipse(v.x, v.y, 22, 22);
    noStroke();

    text(`VAP ${i} (${v.x.toFixed(1)},${v.y.toFixed(1)})`, v.x, v.y - 18);
    // Only show IP if node is large enough
    if (22 >= 18) {
      fill(255, 120);
      textSize(10);
      text(v.ip, v.x, v.y + 13);
    }
    pop();
    // ...pulse effect removed...
  });
}


// Generate random weighted edges between all nodes (simulate network links)
function generateEdges() {
  edges = [];
  // Each node connects to a few others (simulate mesh)
  for (let i = 0; i < allNodes.length; i++) {
    let n = allNodes[i];
    let connections = 2 + Math.floor(random(3));
    let possible = [];
    for (let j = 0; j < allNodes.length; j++) {
      if (i !== j) possible.push(j);
    }
    shuffle(possible, true);
    for (let k = 0; k < connections; k++) {
      let j = possible[k];
      // Weight is Euclidean distance + random jitter, but allow it to change over time
      let n2 = allNodes[j];
      let baseDist = distBetween(n, n2);
      let latency = baseDist + random(20, 120);
      edges.push({ from: i, to: j, weight: latency, base: baseDist });
      edges.push({ from: j, to: i, weight: latency, base: baseDist }); // undirected
    }
  }
}

// Animate edge weights (latency) to simulate network changes
function updateEdgeLatencies() {
  edges.forEach(e => {
    // Simulate latency jitter and congestion
    let jitter = sin((millis() / 2000) + e.from * 0.7 + e.to * 0.3) * 18;
    let congestion = noise(e.from * 0.2, e.to * 0.2, millis() * 0.0002) * 60;
    e.weight = e.base + jitter + congestion;
    // Clamp to minimum
    if (e.weight < e.base + 10) e.weight = e.base + 10;
  });
}

function distBetween(a, b) {
  return sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Dijkstra's algorithm for shortest path
function dijkstra(startIdx, endIdx) {
  let Q = new Set();
  let dist = Array(allNodes.length).fill(Infinity);
  let prev = Array(allNodes.length).fill(null);
  dist[startIdx] = 0;
  for (let i = 0; i < allNodes.length; i++) Q.add(i);
  while (Q.size > 0) {
    // Find node in Q with smallest dist
    let u = null;
    let minDist = Infinity;
    Q.forEach(idx => {
      if (dist[idx] < minDist) {
        minDist = dist[idx];
        u = idx;
      }
    });
    if (u === null || u === endIdx) break;
    Q.delete(u);
    // For each neighbor
    edges.forEach(e => {
      if (e.from === u && Q.has(e.to)) {
        let alt = dist[u] + e.weight;
        if (alt < dist[e.to]) {
          dist[e.to] = alt;
          prev[e.to] = u;
        }
      }
    });
  }
  // Reconstruct path
  let S = [];
  let u = endIdx;
  if (prev[u] !== null || u === startIdx) {
    while (u !== null) {
      S.unshift(u);
      u = prev[u];
    }
  }
  return S;
}

function generateRoutes() {
  routes = [];
  packets = [];
  vaps.forEach((v, i) => {
    // Each VAP finds shortest path to 2-3 routers
    let routerIndices = [];
    while (routerIndices.length < 2 + Math.floor(random(2))) {
      let idx = Math.floor(random(ROUTER_COUNT));
      if (!routerIndices.includes(idx)) routerIndices.push(idx);
    }
    routerIndices.forEach(idx => {
      let path = dijkstra(v.idx, idx);
      if (path.length > 1) {
        // Convert path of indices to node objects
        let points = path.map(j => allNodes[j]);
        // For traceroute, add fake IPs and ghost hops between points
        let hops = [];
        for (let h = 1; h < points.length - 1; h++) {
          let n = points[h];
          hops.push({ x: n.x, y: n.y, ip: randomIP(), ghost: random() < 0.15 });
        }
        routes.push({ from: v, to: routers[idx], hops, points });
        // Create a packet for this route
        let speed = random(0.12, 0.45); // px/ms
        let delay = random(0, 1200); // ms
        let loss = random() < 0.07; // 7% chance of loss
        packets.push({
          routeIdx: routes.length - 1,
          t: 0,
          speed,
          delay,
          lost: loss,
          fade: 1,
          stopped: false,
          startTime: millis()
        });
      }
    });
  });
}

function draw() {
    // Simulate rare network events
    if (millis() - lastEventTime > EVENT_INTERVAL) {
      lastEventTime = millis();
      if (Math.random() < 0.5) {
        // Simulate link failure: randomly increase latency for some edges
        let affected = Math.floor(Math.random() * edges.length);
        edges[affected].weight += random(120, 400);
      } else {
        // Simulate rerouting: shuffle routes
        routes.forEach(r => {
          shuffle(r.points, true);
        });
      }
    }
    clear();
    background(0, 220);
    // Display real-time stats overlay at top left, no box
    push();
    fill(255, 220);
    textSize(15);
    textAlign(LEFT, TOP);
    text('Packets Sent: ' + stats.sent + '  Delivered: ' + stats.delivered + '  Lost: ' + stats.lost + '  Avg Latency: ' + stats.avgLatency.toFixed(1) + 'ms', 12, 8);
    pop();
    updateEdgeLatencies();
    drawMesh();
    drawRoutes();
    drawNodes();
    drawSSID();
    // Smoothly update packet paths and speeds
    updatePacketPaths();
    // Remove stopped packets so new ones can be sent
    packets = packets.filter(p => !p.stopped);
    // Generate new packets if not too many in flight
    const MAX_PACKETS = 40;
    if (packets.length < MAX_PACKETS && routes.length > 0) {
      if (shouldGeneratePacket()) {
        let routeIdx = Math.floor(Math.random() * routes.length);
        let route = routes[routeIdx];
        let speed = random(0.12, 0.45);
        let delay = random(0, 1200);
        let points = route.points;
        let x = points && points[0] ? points[0].x : 0;
        let y = points && points[0] ? points[0].y : 0;
        packets.push({
          routeIdx,
          t: 0,
          speed,
          delay,
          lost: false,
          fade: 1,
          stopped: false,
          lossHop: null,
          x,
          y,
          path: [points[0]],
          color: [255, 255, 255],
          startTime: millis()
        });
        stats.sent++;
      }
    }
  }


// For each packet, check if a better path exists and smoothly transition
function updatePacketPaths() {
  packets.forEach(packet => {
    let route = routes[packet.routeIdx];
    if (!route) return;
    let points = route.points;
    if (!points || points.length < 2) return;
    // Loss: at each hop, chance based on edge latency
    if (!packet.lost && !packet.stopped) {
      for (let i = 0; i < points.length - 1; i++) {
        let from = points[i];
        let to = points[i + 1];
        let edge = edges.find(e => e.from === from.idx && e.to === to.idx);
        let latency = edge ? edge.weight : 100;
        let lossProb = map(latency, 100, 600, 0.0001, 0.0005, true);
        if (Math.random() < lossProb) {
          packet.lost = true;
          packet.lossHop = i;
          packet.color = [255, 40, 40];
          break;
        }
      }
    }
    // If lost, start fading out
    if (packet.lost) {
      packet.fade -= 0.04;
      if (packet.fade <= 0) packet.stopped = true;
      // Record path for fading line
      if (packet.path && packet.path.length > 1 && !packet._recorded) {
        recentPaths.push({ path: [...packet.path], color: packet.color, time: millis() });
        packet._recorded = true;
        stats.lost++;
      }
      return;
    }
    // Normal path update
    let now = millis();
    if (!packet._start) packet._start = now;
    if (now < packet.delay + packet._start) return;
    let dt = (now - packet._start - packet.delay) * packet.speed;
    let segLens = [];
    for (let i = 0; i < points.length - 1; i++) {
      let d = distBetween(points[i], points[i + 1]);
      segLens.push(d);
    }
    let travel = dt;
    let seg = 0;
    while (seg < segLens.length && travel > segLens[seg]) {
      travel -= segLens[seg];
      seg++;
    }
    if (seg >= segLens.length) {
      // Only start fading out after arrival
      if (!packet.arrived) {
        packet.arrived = true;
        packet.fade = 1;
        packet.color = [80, 255, 80];
        stats.delivered++;
        if (stats.delivered > 0) {
          stats.avgLatency = (stats.avgLatency * (stats.delivered - 1) + (now - packet.startTime)) / stats.delivered;
        } else {
          stats.avgLatency = 0;
        }
        // Record path for fading line
        if (packet.path && packet.path.length > 1 && !packet._recorded) {
          recentPaths.push({ path: [...packet.path], color: packet.color, time: millis() });
          packet._recorded = true;
        }
      }
      packet.fade -= 0.04;
      if (packet.fade <= 0) packet.stopped = true;
      return;
    }
    let t = travel / segLens[seg];
    packet.x = lerp(points[seg].x, points[seg + 1].x, t);
    packet.y = lerp(points[seg].y, points[seg + 1].y, t);
    // Track path for fading line
    if (packet.path) {
      if (!packet.path.length || distBetween(packet.path[packet.path.length - 1], { x: packet.x, y: packet.y }) > 6) {
        packet.path.push({ x: packet.x, y: packet.y });
      }
    }
  });
  // Path morphing and speed adjustment (if needed)
  packets.forEach(packet => {
    let route = routes[packet.routeIdx];
    if (!route) return;
    let fromIdx = route.from.idx;
    let toIdx = route.to.idx;
    // Find current best path
    let newPath = dijkstra(fromIdx, toIdx);
    if (!newPath || newPath.length < 2) return;
    let newPoints = newPath.map(j => allNodes[j]);
    // If path changed, smoothly morph to new path
    if (!route.points || route.points.length !== newPoints.length || !route.points.every((pt, i) => pt === newPoints[i])) {
      // Interpolate between old and new path for smoothness
      if (!route._morph) {
        route._morph = { t: 0, from: route.points, to: newPoints };
      }
      route._morph.t += 0.04;
      if (route._morph.t >= 1) {
        route.points = newPoints;
        route._morph = null;
      } else {
        // Interpolate each point
        let interp = [];
        let from = route._morph.from;
        let to = route._morph.to;
        for (let i = 0; i < Math.min(from.length, to.length); i++) {
          let x = lerp(from[i].x, to[i].x, route._morph.t);
          let y = lerp(from[i].y, to[i].y, route._morph.t);
          interp.push({ x, y });
        }
        // If new path is longer, append extra points
        for (let i = from.length; i < to.length; i++) interp.push({ x: to[i].x, y: to[i].y });
        route.points = interp;
      }
    }
    // Adjust packet speed based on new path's total latency
    let totalLatency = 0;
    for (let i = 0; i < newPoints.length - 1; i++) {
      let a = newPoints[i].idx;
      let b = newPoints[i + 1].idx;
      let edge = edges.find(e => e.from === a && e.to === b);
      totalLatency += edge ? edge.weight : 100;
    }
    // Map latency to speed (higher latency = slower)
    let speed = map(totalLatency, 400, 2200, 0.5, 0.25, true);
    packet.speed = lerp(packet.speed, speed, 0.1);
  });
}


function drawSSID() {
  push();
  fill(0, 180);
  rectMode(CENTER);
  rect(width / 2, height - 44, 340, 54, 12);
  fill(255, 220);
  textSize(16);
  text('SSID: ' + ssid, width / 2, height - 56);
  fill(255, 120);
  textSize(12);
  text('-67dBm  |  Virtual APs: ' + VAP_COUNT + '  |  Routers: ' + ROUTER_COUNT + '  |  Traceroutes: ' + routes.length, width / 2, height - 34);
  pop();
}
