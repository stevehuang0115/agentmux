import * as THREE from 'three';
// OrbitControls removed - using custom mouse/keyboard controls
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 30, 80);

// Night mode state: 'day', 'night', 'auto'
let lightingMode = 'auto';
let isNightMode = false; // Computed based on mode and time
const dayBackground = 0x87CEEB;
const nightBackground = 0x0a0a1a;
const dayFog = 0x87CEEB;
const nightFog = 0x0a0a1a;
const dayWallColor = 0xe8e4de;  // Warm off-white/cream
const nightWallColor = 0x2a2a35;  // Dark gray-blue
const dayFloorColor = 0x5a5a6a;  // Medium gray-blue carpet
const nightFloorColor = 0x1a1a25;  // Very dark floor

// Check if it should be night based on local time (6 PM - 6 AM)
function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8, 6, 12);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// ====== CAMERA CONTROLS ======
// Camera rotation state (for mouse look)
// Calculate initial yaw/pitch to look from (8,6,12) toward (0,1,0)
const targetPos = new THREE.Vector3(0, 1, 0);
const camPos = camera.position.clone();
const toTarget = targetPos.clone().sub(camPos);
let cameraYaw = Math.atan2(toTarget.x, toTarget.z); // Horizontal angle
let cameraPitch = Math.atan2(toTarget.y, Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z)); // Vertical angle
const lookSensitivity = 0.002;
const minPitch = -Math.PI / 2 + 0.1;
const maxPitch = Math.PI / 2 - 0.1;

// Apply initial camera direction
camera.lookAt(targetPos);

// Mouse state
const mouseState = {
  isDragging: false,
  lastX: 0,
  lastY: 0
};

// Keyboard state
const keyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false
};

// Update camera direction from yaw/pitch
function updateCameraDirection() {
  const direction = new THREE.Vector3(
    Math.sin(cameraYaw) * Math.cos(cameraPitch),
    Math.sin(cameraPitch),
    Math.cos(cameraYaw) * Math.cos(cameraPitch)
  );
  const target = camera.position.clone().add(direction);
  camera.lookAt(target);
}

// Mouse drag = rotate camera view (like OrbitControls)
renderer.domElement.addEventListener('mousemove', (e) => {
  if (mouseState.isDragging) {
    // Dragging = rotate camera view
    const deltaX = e.clientX - mouseState.lastX;
    const deltaY = e.clientY - mouseState.lastY;

    // Update yaw and pitch based on drag
    cameraYaw -= deltaX * 0.005;
    cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch - deltaY * 0.005));

    updateCameraDirection();

    mouseState.lastX = e.clientX;
    mouseState.lastY = e.clientY;
  }
  // Mouse move without drag = does nothing
});

// Mouse down = start drag for rotation
renderer.domElement.addEventListener('mousedown', (e) => {
  mouseState.isDragging = true;
  mouseState.lastX = e.clientX;
  mouseState.lastY = e.clientY;
  renderer.domElement.style.cursor = 'grabbing';
});

document.addEventListener('mouseup', () => {
  mouseState.isDragging = false;
  renderer.domElement.style.cursor = 'default';
});

// Scroll to zoom
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomSpeed = 0.5;
  const forward = new THREE.Vector3(
    Math.sin(cameraYaw) * Math.cos(cameraPitch),
    Math.sin(cameraPitch),
    Math.cos(cameraYaw) * Math.cos(cameraPitch)
  );

  if (e.deltaY < 0) {
    // Zoom in (scroll up)
    camera.position.addScaledVector(forward, zoomSpeed);
  } else {
    // Zoom out (scroll down)
    camera.position.addScaledVector(forward, -zoomSpeed);
  }
}, { passive: false });

// ====== TOUCH CONTROLS ======
// Touch state for mobile devices
const touchState = {
  isDragging: false,
  lastX: 0,
  lastY: 0,
  // Pinch zoom state
  isPinching: false,
  initialPinchDistance: 0,
  // Two-finger pan state
  lastPinchCenterX: 0,
  lastPinchCenterY: 0,
  // Tap detection state
  touchStartTime: 0,
  touchStartX: 0,
  touchStartY: 0,
  hasMoved: false,
  // Double-tap detection state
  lastTapTime: 0,
  lastTapX: 0,
  lastTapY: 0
};

// Tap-to-move state
const tapMoveState = {
  isMoving: false,
  targetPosition: null,
  moveSpeed: 8, // Units per second
  arrivalThreshold: 0.5 // How close to target before stopping
};

// Raycaster for tap detection
const raycaster = new THREE.Raycaster();
const tapPoint = new THREE.Vector2();

// Visual indicator for tap destination
const tapIndicator = createTapIndicator();
scene.add(tapIndicator);
tapIndicator.visible = false;

function createTapIndicator() {
  const group = new THREE.Group();

  // Outer ring
  const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a73ea,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  // Center dot
  const dotGeometry = new THREE.CircleGeometry(0.15, 16);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a73ea,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.05;
  group.add(dot);

  return group;
}

// Calculate distance between two touch points
function getTouchDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate center point between two touches
function getTouchCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

// Touch start - begin rotation or pinch zoom
renderer.domElement.addEventListener('touchstart', (e) => {
  e.preventDefault();

  if (e.touches.length === 1) {
    // Single finger - start rotation and track for tap
    touchState.isDragging = true;
    touchState.isPinching = false;
    touchState.lastX = e.touches[0].clientX;
    touchState.lastY = e.touches[0].clientY;
    // Track for tap detection
    touchState.touchStartTime = Date.now();
    touchState.touchStartX = e.touches[0].clientX;
    touchState.touchStartY = e.touches[0].clientY;
    touchState.hasMoved = false;
  } else if (e.touches.length === 2) {
    // Two fingers - start pinch zoom and pan
    touchState.isDragging = false;
    touchState.isPinching = true;
    touchState.initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const center = getTouchCenter(e.touches[0], e.touches[1]);
    touchState.lastPinchCenterX = center.x;
    touchState.lastPinchCenterY = center.y;
    // Cancel tap detection
    touchState.hasMoved = true;
  }
}, { passive: false });

// Touch move - rotate camera or zoom
renderer.domElement.addEventListener('touchmove', (e) => {
  e.preventDefault();

  if (e.touches.length === 1 && touchState.isDragging) {
    // Single finger drag - rotate camera
    const deltaX = e.touches[0].clientX - touchState.lastX;
    const deltaY = e.touches[0].clientY - touchState.lastY;

    // Check if moved enough to cancel tap (threshold: 10 pixels)
    const totalMoveX = Math.abs(e.touches[0].clientX - touchState.touchStartX);
    const totalMoveY = Math.abs(e.touches[0].clientY - touchState.touchStartY);
    if (totalMoveX > 10 || totalMoveY > 10) {
      touchState.hasMoved = true;
      // Cancel any ongoing tap-to-move when user starts dragging
      if (tapMoveState.isMoving) {
        tapMoveState.isMoving = false;
        tapMoveState.targetPosition = null;
        tapIndicator.visible = false;
      }
    }

    // Update yaw and pitch (reversed left/right for natural touch feel)
    cameraYaw += deltaX * 0.008;
    cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch + deltaY * 0.008));

    updateCameraDirection();

    touchState.lastX = e.touches[0].clientX;
    touchState.lastY = e.touches[0].clientY;
  } else if (e.touches.length === 2 && touchState.isPinching) {
    // Two finger pinch - zoom and pan
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const delta = currentDistance - touchState.initialPinchDistance;

    // Calculate zoom based on pinch delta
    const zoomSpeed = 0.02;
    const forward = new THREE.Vector3(
      Math.sin(cameraYaw) * Math.cos(cameraPitch),
      Math.sin(cameraPitch),
      Math.cos(cameraYaw) * Math.cos(cameraPitch)
    );

    camera.position.addScaledVector(forward, delta * zoomSpeed);

    // Calculate pan based on center movement
    const center = getTouchCenter(e.touches[0], e.touches[1]);
    const panDeltaX = center.x - touchState.lastPinchCenterX;
    const panDeltaY = center.y - touchState.lastPinchCenterY;

    // Pan camera (move in the opposite direction of finger movement)
    const panSpeed = 0.02;
    const right = new THREE.Vector3(Math.sin(cameraYaw + Math.PI/2), 0, Math.cos(cameraYaw + Math.PI/2));
    const up = new THREE.Vector3(0, 1, 0);

    camera.position.addScaledVector(right, -panDeltaX * panSpeed);
    camera.position.addScaledVector(up, panDeltaY * panSpeed);

    // Update state for continuous zoom/pan
    touchState.initialPinchDistance = currentDistance;
    touchState.lastPinchCenterX = center.x;
    touchState.lastPinchCenterY = center.y;
  }
}, { passive: false });

// Touch end - stop rotation/zoom and detect double taps
renderer.domElement.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    const now = Date.now();
    // Check if this was a tap (short duration, minimal movement)
    const tapDuration = now - touchState.touchStartTime;
    const isTap = tapDuration < 300 && !touchState.hasMoved;

    if (isTap) {
      // Check for double tap
      const timeSinceLastTap = now - touchState.lastTapTime;
      const distanceFromLastTap = Math.sqrt(
        Math.pow(touchState.touchStartX - touchState.lastTapX, 2) +
        Math.pow(touchState.touchStartY - touchState.lastTapY, 2)
      );

      // Double tap: two taps within 400ms and 50 pixels of each other
      if (timeSinceLastTap < 400 && distanceFromLastTap < 50) {
        // Handle double-tap-to-move
        handleTapToMove(touchState.touchStartX, touchState.touchStartY);
        // Reset last tap to prevent triple-tap triggering another move
        touchState.lastTapTime = 0;
      } else {
        // Record this tap for potential double-tap
        touchState.lastTapTime = now;
        touchState.lastTapX = touchState.touchStartX;
        touchState.lastTapY = touchState.touchStartY;
      }
    }

    touchState.isDragging = false;
    touchState.isPinching = false;
  } else if (e.touches.length === 1) {
    // Switched from pinch to single finger
    touchState.isDragging = true;
    touchState.isPinching = false;
    touchState.lastX = e.touches[0].clientX;
    touchState.lastY = e.touches[0].clientY;
    // Reset tap tracking for new touch
    touchState.touchStartTime = Date.now();
    touchState.touchStartX = e.touches[0].clientX;
    touchState.touchStartY = e.touches[0].clientY;
    touchState.hasMoved = false;
  }
});

// Handle tap-to-move: raycast to find ground position and move camera there
function handleTapToMove(screenX, screenY) {
  // Convert screen coordinates to normalized device coordinates (-1 to +1)
  tapPoint.x = (screenX / window.innerWidth) * 2 - 1;
  tapPoint.y = -(screenY / window.innerHeight) * 2 + 1;

  // Cast ray from camera through tap point
  raycaster.setFromCamera(tapPoint, camera);

  // Find intersections with ground plane (y = 0) and other walkable surfaces
  // Create a large invisible ground plane for raycasting
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectPoint = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
    // Valid intersection with ground
    // Set target position (keep camera at current height)
    tapMoveState.targetPosition = new THREE.Vector3(
      intersectPoint.x,
      camera.position.y, // Maintain current height
      intersectPoint.z
    );
    tapMoveState.isMoving = true;

    // Show tap indicator at destination
    tapIndicator.position.set(intersectPoint.x, 0.1, intersectPoint.z);
    tapIndicator.visible = true;

    // Animate indicator scale
    tapIndicator.scale.set(0.5, 0.5, 0.5);
  }
}

// Update tap-to-move in animation loop
function updateTapToMove(delta) {
  if (!tapMoveState.isMoving || !tapMoveState.targetPosition) return;

  const currentPos = camera.position;
  const targetPos = tapMoveState.targetPosition;

  // Calculate horizontal distance to target
  const dx = targetPos.x - currentPos.x;
  const dz = targetPos.z - currentPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < tapMoveState.arrivalThreshold) {
    // Arrived at destination
    tapMoveState.isMoving = false;
    tapMoveState.targetPosition = null;
    tapIndicator.visible = false;
    return;
  }

  // Move towards target
  const moveAmount = Math.min(tapMoveState.moveSpeed * delta, distance);
  const moveRatio = moveAmount / distance;

  camera.position.x += dx * moveRatio;
  camera.position.z += dz * moveRatio;

  // Update camera yaw to face movement direction
  const targetYaw = Math.atan2(dx, dz);
  // Smoothly interpolate yaw
  let yawDiff = targetYaw - cameraYaw;
  // Normalize to -PI to PI
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
  cameraYaw += yawDiff * 0.1;

  updateCameraDirection();

  // Animate tap indicator (pulsing effect)
  const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
  tapIndicator.scale.set(pulse, pulse, pulse);
}

// Touch cancel - reset state
renderer.domElement.addEventListener('touchcancel', () => {
  touchState.isDragging = false;
  touchState.isPinching = false;
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keyState.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keyState.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keyState.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keyState.right = true;
      break;
    case 'KeyQ':
    case 'Space':
      keyState.up = true;
      e.preventDefault();
      break;
    case 'KeyE':
    case 'ShiftLeft':
    case 'ShiftRight':
      keyState.down = true;
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keyState.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keyState.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keyState.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keyState.right = false;
      break;
    case 'KeyQ':
    case 'Space':
      keyState.up = false;
      break;
    case 'KeyE':
    case 'ShiftLeft':
    case 'ShiftRight':
      keyState.down = false;
      break;
  }
});

function updateCameraFromKeyboard(delta) {
  const moveSpeed = 10 * delta;

  // Get camera direction vectors (horizontal only for movement)
  const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.sin(cameraYaw + Math.PI/2), 0, Math.cos(cameraYaw + Math.PI/2));

  // Apply movement (A/left = move right, D/right = move left - swapped for natural feel)
  if (keyState.forward) {
    camera.position.addScaledVector(forward, moveSpeed);
  }
  if (keyState.backward) {
    camera.position.addScaledVector(forward, -moveSpeed);
  }
  if (keyState.left) {
    camera.position.addScaledVector(right, moveSpeed); // Swapped
  }
  if (keyState.right) {
    camera.position.addScaledVector(right, -moveSpeed); // Swapped
  }
  if (keyState.up) {
    camera.position.y += moveSpeed;
  }
  if (keyState.down) {
    camera.position.y = Math.max(1, camera.position.y - moveSpeed);
  }

  // Update camera direction after movement
  updateCameraDirection();
}

// ====== LIGHTING ======
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(15, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
sunLight.shadow.bias = -0.0001;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
fillLight.position.set(-10, 10, -5);
scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Ceiling lights removed for cleaner look

// ====== CORPORATE OFFICE FLOOR (1.2x scale) ======
const floorGeo = new THREE.PlaneGeometry(48, 48);
// Corporate gray carpet tile look
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x5a5a6a,  // Medium gray-blue carpet
  roughness: 0.9,    // Carpet texture (matte)
  metalness: 0.0
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Subtle grid for corporate tile pattern
const gridHelper = new THREE.GridHelper(48, 24, 0x4a4a5a, 0x505060);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// ====== CORPORATE OFFICE WALLS ======
// Off-white/cream corporate wall color
const wallMat = new THREE.MeshStandardMaterial({
  color: 0xe8e4de,  // Warm off-white/cream
  roughness: 0.7,
  metalness: 0.0
});

// Accent stripe at bottom of walls (baseboard)
const baseboardMat = new THREE.MeshStandardMaterial({
  color: 0x4a4a5a,  // Dark gray baseboard
  roughness: 0.5
});

const backWall = new THREE.Mesh(new THREE.BoxGeometry(48, 16, 0.3), wallMat);
backWall.position.set(0, 8, -24);
backWall.receiveShadow = true;
scene.add(backWall);

// Left wall with gaps for windows (1.2x scaled)
// Windows at z=-10 and z=8, each 5 units wide, so gaps at z=-12.5 to -7.5 and z=5.5 to 10.5
// Wall segment 1: z from -24 to -12.5 (11.5 units, center at -18.25)
const leftWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 11.5), wallMat);
leftWall1.position.set(-24, 8, -18.25);
leftWall1.receiveShadow = true;
scene.add(leftWall1);

// Wall segment 2: z from -7.5 to 5.5 (13 units, center at -1)
const leftWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 13), wallMat);
leftWall2.position.set(-24, 8, -1);
leftWall2.receiveShadow = true;
scene.add(leftWall2);

// Wall segment 3: z from 10.5 to 24 (13.5 units, center at 17.25)
const leftWall3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 13.5), wallMat);
leftWall3.position.set(-24, 8, 17.25);
leftWall3.receiveShadow = true;
scene.add(leftWall3);

// Wall above windows (y from 9 to 16, so 7 units tall, center at 12.5)
const leftWallTop1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 5), wallMat);
leftWallTop1.position.set(-24, 12.5, -10);
scene.add(leftWallTop1);
const leftWallTop2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 5), wallMat);
leftWallTop2.position.set(-24, 12.5, 8);
scene.add(leftWallTop2);

// Wall below windows (y from 0 to 3, so 3 units tall, center at 1.5)
const leftWallBot1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 5), wallMat);
leftWallBot1.position.set(-24, 1.5, -10);
scene.add(leftWallBot1);
const leftWallBot2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 5), wallMat);
leftWallBot2.position.set(-24, 1.5, 8);
scene.add(leftWallBot2);

// Right wall - same pattern
const rightWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 11.5), wallMat);
rightWall1.position.set(24, 8, -18.25);
rightWall1.receiveShadow = true;
scene.add(rightWall1);

const rightWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 13), wallMat);
rightWall2.position.set(24, 8, -1);
rightWall2.receiveShadow = true;
scene.add(rightWall2);

const rightWall3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 16, 13.5), wallMat);
rightWall3.position.set(24, 8, 17.25);
rightWall3.receiveShadow = true;
scene.add(rightWall3);

// Wall above/below windows on right
const rightWallTop1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 5), wallMat);
rightWallTop1.position.set(24, 12.5, -10);
scene.add(rightWallTop1);
const rightWallTop2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 5), wallMat);
rightWallTop2.position.set(24, 12.5, 8);
scene.add(rightWallTop2);

const rightWallBot1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 5), wallMat);
rightWallBot1.position.set(24, 1.5, -10);
scene.add(rightWallBot1);
const rightWallBot2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 5), wallMat);
rightWallBot2.position.set(24, 1.5, 8);
scene.add(rightWallBot2);

// ====== WINDOWS ======
// Modern corporate window frames - dark charcoal metal
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.3, metalness: 0.6 });
// Clear glass - almost invisible to see outdoor views clearly
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.05,
  roughness: 0.0,
  metalness: 0.0,
  transmission: 0.95,  // High transmission for see-through effect
  thickness: 0.1,
  side: THREE.DoubleSide
});

// Large corporate floor-to-ceiling style windows - open to see outdoor scene
function createWindow(x, y, z, rotationY = 0) {
  const windowGroup = new THREE.Group();

  // No glass - just the frame so outdoor scene is visible through wall gaps

  // Slim modern frame
  const frameThickness = 0.08;
  const frameDepth = 0.12;

  // Top frame
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, frameThickness, frameDepth), windowFrameMat);
  topFrame.position.y = 3.05;
  windowGroup.add(topFrame);

  // Bottom frame
  const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, frameThickness, frameDepth), windowFrameMat);
  bottomFrame.position.y = -3.05;
  windowGroup.add(bottomFrame);

  // Left frame
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, 6.2, frameDepth), windowFrameMat);
  leftFrame.position.x = -2.55;
  windowGroup.add(leftFrame);

  // Right frame
  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, 6.2, frameDepth), windowFrameMat);
  rightFrame.position.x = 2.55;
  windowGroup.add(rightFrame);

  // Single vertical divider (modern look)
  const midVertical = new THREE.Mesh(new THREE.BoxGeometry(frameThickness * 0.6, 6, frameDepth * 0.6), windowFrameMat);
  windowGroup.add(midVertical);

  windowGroup.position.set(x, y, z);
  windowGroup.rotation.y = rotationY;
  scene.add(windowGroup);
  return windowGroup;
}

// Add windows on left wall (1.2x scaled positions)
createWindow(-23.8, 6, -10, Math.PI / 2);
createWindow(-23.8, 6, 8, Math.PI / 2);

// Add windows on right wall
createWindow(23.8, 6, -10, -Math.PI / 2);
createWindow(23.8, 6, 8, -Math.PI / 2);

// ====== DOOR ======
const doorGroup = new THREE.Group();
const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
// Door panel
const doorGeo = new THREE.BoxGeometry(2, 3.5, 0.1);
const door = new THREE.Mesh(doorGeo, doorMat);
door.position.y = 1.75;
doorGroup.add(door);
// Door frame
// Modern corporate door frame - dark charcoal metal
const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.3, metalness: 0.6 });
const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.2), doorFrameMat);
doorFrameTop.position.y = 3.55;
doorGroup.add(doorFrameTop);
const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.7, 0.2), doorFrameMat);
doorFrameLeft.position.set(-1.1, 1.75, 0);
doorGroup.add(doorFrameLeft);
const doorFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.7, 0.2), doorFrameMat);
doorFrameRight.position.set(1.1, 1.75, 0);
doorGroup.add(doorFrameRight);
// Door handle
const handleMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.8, roughness: 0.2 });
const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), handleMat);
handle.position.set(0.7, 1.75, 0.1);
doorGroup.add(handle);
doorGroup.position.set(23.85, 0, 15);  // 1.2x scaled position
doorGroup.rotation.y = -Math.PI / 2;
scene.add(doorGroup);

// ====== OUTDOOR SCENERY ======
const outdoorGroup = new THREE.Group();
outdoorGroup.position.set(26, 0, 0); // Right outside the right wall (wall is at x=24)

// Ground/grass outside (positioned lower to avoid overlapping indoor floor)
const grassMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9 });
const grass = new THREE.Mesh(new THREE.PlaneGeometry(25, 50), grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.set(8, -0.1, 0); // Moved further out and slightly below floor level
outdoorGroup.add(grass);

// Street
const streetMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
const street = new THREE.Mesh(new THREE.PlaneGeometry(6, 50), streetMat);
street.rotation.x = -Math.PI / 2;
street.position.set(12, 0.01, 0);
outdoorGroup.add(street);

// Street lines
const lineMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
for (let i = -20; i < 20; i += 4) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(12, 0.02, i);
  outdoorGroup.add(line);
}

// Trees
function createTree(x, z, height = 3) {
  const treeGroup = new THREE.Group();
  // Trunk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, height * 0.5, 8), trunkMat);
  trunk.position.y = height * 0.25;
  treeGroup.add(trunk);
  // Foliage (3 cones stacked)
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  for (let i = 0; i < 3; i++) {
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(height * 0.4 - i * 0.2, height * 0.5, 8),
      foliageMat
    );
    foliage.position.y = height * 0.5 + i * height * 0.25;
    treeGroup.add(foliage);
  }
  treeGroup.position.set(x, 0, z);
  return treeGroup;
}

// Add trees along the street
[-15, -8, 0, 8, 15].forEach(z => {
  outdoorGroup.add(createTree(3, z, 3 + Math.random()));
  outdoorGroup.add(createTree(18, z, 3 + Math.random()));
});

// Houses across the street
function createHouse(x, z) {
  const houseGroup = new THREE.Group();
  // Main body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xF5DEB3 + Math.random() * 0x202020 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), bodyMat);
  body.position.y = 1.25;
  houseGroup.add(body);
  // Roof
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8B0000 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.5, 4), roofMat);
  roof.position.y = 3.25;
  roof.rotation.y = Math.PI / 4;
  houseGroup.add(roof);
  // Door
  const houseDoorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const houseDoor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.1), houseDoorMat);
  houseDoor.position.set(0, 0.6, 1.55);
  houseGroup.add(houseDoor);
  // Windows
  const houseWinMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, emissive: 0x87CEEB, emissiveIntensity: 0.2 });
  [-0.8, 0.8].forEach(xOff => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), houseWinMat);
    win.position.set(xOff, 1.5, 1.51);
    houseGroup.add(win);
  });
  houseGroup.position.set(x, 0, z);
  return houseGroup;
}

// Add houses
[-12, -4, 4, 12].forEach(z => {
  outdoorGroup.add(createHouse(20, z));
});

// Clouds
function createCloud(x, y, z) {
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9 });
  const sizes = [0.8, 1.2, 1, 0.7, 0.9];
  const offsets = [[-1, 0, 0], [0, 0.3, 0], [1, 0, 0.2], [-0.5, -0.2, 0.3], [0.7, 0.1, -0.2]];
  sizes.forEach((size, i) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), cloudMat);
    puff.position.set(...offsets[i]);
    cloudGroup.add(puff);
  });
  cloudGroup.position.set(x, y, z);
  cloudGroup.scale.set(1.5, 0.8, 1);
  return cloudGroup;
}

// Add clouds - positioned further out so they don't appear inside building
// (outdoor group is at x=22, wall at x=20, so clouds need x > 0 to be outside)
[[5, 12, -10], [12, 14, 5], [8, 11, 15], [18, 13, -5], [15, 15, 0]].forEach(pos => {
  outdoorGroup.add(createCloud(...pos));
});

scene.add(outdoorGroup);

// Also add outdoor scenery on left side
const outdoorGroupLeft = outdoorGroup.clone();
outdoorGroupLeft.position.set(-26, 0, 0); // Right outside the left wall (wall is at x=-24)
outdoorGroupLeft.rotation.y = Math.PI;
scene.add(outdoorGroupLeft);

// ====== COMPANY NAME ON BACK WALL - CLEAN BLACK ======
const companyCanvas = document.createElement('canvas');
companyCanvas.width = 2048;
companyCanvas.height = 512;
const companyCtx = companyCanvas.getContext('2d');

// Transparent background
companyCtx.clearRect(0, 0, 2048, 512);

// Clean black text with modern font
companyCtx.font = '600 220px "Helvetica Neue", Helvetica, Arial, sans-serif';
companyCtx.textAlign = 'center';
companyCtx.textBaseline = 'middle';

// Subtle shadow for depth
companyCtx.shadowColor = 'rgba(0, 0, 0, 0.15)';
companyCtx.shadowBlur = 10;
companyCtx.shadowOffsetX = 4;
companyCtx.shadowOffsetY = 4;

// Black text
companyCtx.fillStyle = '#1a1a1a';
companyCtx.fillText("AgentMux Factory", 1024, 256);

const companyTexture = new THREE.CanvasTexture(companyCanvas);
const companyGeo = new THREE.PlaneGeometry(22, 5);
const companyMat = new THREE.MeshStandardMaterial({
  map: companyTexture,
  transparent: true
});
const companySign = new THREE.Mesh(companyGeo, companyMat);
companySign.position.set(0, 12, -23.8);  // Higher for taller ceiling, 1.2x scale
scene.add(companySign);

// ====== EXTERIOR FRONT WALL AND BRANDING ======
// Front wall (visible from outside)
const frontWallMat = new THREE.MeshStandardMaterial({
  color: 0xd0d0d5,  // Light gray corporate exterior
  roughness: 0.6,
  metalness: 0.1
});

// Main front wall with large opening for entrance
const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 0.5), frontWallMat);
frontWallLeft.position.set(-16, 8, 24);
frontWallLeft.receiveShadow = true;
scene.add(frontWallLeft);

const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 0.5), frontWallMat);
frontWallRight.position.set(16, 8, 24);
frontWallRight.receiveShadow = true;
scene.add(frontWallRight);

// Wall above entrance
const frontWallTop = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 0.5), frontWallMat);
frontWallTop.position.set(0, 12, 24);
frontWallTop.receiveShadow = true;
scene.add(frontWallTop);

// Large corporate glass entrance doors
const entranceGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0x88ccff,
  transparent: true,
  opacity: 0.4,
  roughness: 0.0,
  metalness: 0.3,
  side: THREE.DoubleSide
});
const entranceDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.1), entranceGlassMat);
entranceDoorLeft.position.set(-4, 3.5, 24);
scene.add(entranceDoorLeft);
const entranceDoorRight = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 0.1), entranceGlassMat);
entranceDoorRight.position.set(4, 3.5, 24);
scene.add(entranceDoorRight);

// Entrance door frames
const entranceFrameMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.7, roughness: 0.3 });
const entranceFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.5, 0.3), entranceFrameMat);
entranceFrameLeft.position.set(-8, 3.75, 24);
scene.add(entranceFrameLeft);
const entranceFrameCenter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.5, 0.3), entranceFrameMat);
entranceFrameCenter.position.set(0, 3.75, 24);
scene.add(entranceFrameCenter);
const entranceFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.5, 0.3), entranceFrameMat);
entranceFrameRight.position.set(8, 3.75, 24);
scene.add(entranceFrameRight);
const entranceFrameTop = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.3, 0.3), entranceFrameMat);
entranceFrameTop.position.set(0, 7.5, 24);
scene.add(entranceFrameTop);

// EXTERIOR BRANDING - Large illuminated sign above entrance
const exteriorCanvas = document.createElement('canvas');
exteriorCanvas.width = 2048;
exteriorCanvas.height = 512;
const extCtx = exteriorCanvas.getContext('2d');

// Dark background for contrast
extCtx.fillStyle = '#1a1a1a';
extCtx.fillRect(0, 0, 2048, 512);

// Glowing text effect
extCtx.shadowColor = '#4a90d9';
extCtx.shadowBlur = 30;
extCtx.fillStyle = '#ffffff';
extCtx.font = 'bold 200px Helvetica Neue, Arial';
extCtx.textAlign = 'center';
extCtx.textBaseline = 'middle';
extCtx.fillText('AgentMux Factory', 1024, 256);

// Second pass for brighter glow
extCtx.shadowBlur = 15;
extCtx.fillText('AgentMux Factory', 1024, 256);

const exteriorTexture = new THREE.CanvasTexture(exteriorCanvas);
const exteriorGeo = new THREE.PlaneGeometry(20, 5);
const exteriorMat = new THREE.MeshStandardMaterial({
  map: exteriorTexture,
  emissive: 0x4a90d9,
  emissiveIntensity: 0.3,
  transparent: true
});
const exteriorSign = new THREE.Mesh(exteriorGeo, exteriorMat);
exteriorSign.position.set(0, 12, 24.3);  // On front wall exterior
scene.add(exteriorSign);

// Outdoor grass lawn in front of building
const lawnMat = new THREE.MeshStandardMaterial({ color: 0x4a8f3c, roughness: 0.9 });
const lawn = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), lawnMat);
lawn.rotation.x = -Math.PI / 2;
lawn.position.set(0, -0.01, 45);
lawn.receiveShadow = true;
scene.add(lawn);

// Concrete walkway to entrance
const walkwayMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.8 });
const walkway = new THREE.Mesh(new THREE.PlaneGeometry(12, 25), walkwayMat);
walkway.rotation.x = -Math.PI / 2;
walkway.position.set(0, 0, 37);
walkway.receiveShadow = true;
scene.add(walkway);

// ====== EXTERIOR DECORATIONS ======
// Large potted plants by entrance
function createExteriorPlant(x, z) {
  const group = new THREE.Group();
  // Pot
  const potGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.8, 8);
  const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.4;
  group.add(pot);
  // Plant bush
  const bushGeo = new THREE.SphereGeometry(0.9, 8, 8);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });
  const bush = new THREE.Mesh(bushGeo, bushMat);
  bush.position.y = 1.3;
  bush.scale.y = 1.2;
  group.add(bush);
  group.position.set(x, 0, z);
  return group;
}

// Plants by entrance
scene.add(createExteriorPlant(-10, 25));
scene.add(createExteriorPlant(10, 25));
scene.add(createExteriorPlant(-12, 30));
scene.add(createExteriorPlant(12, 30));

// Decorative hedges along building
function createHedge(x, z, width) {
  const hedgeGeo = new THREE.BoxGeometry(width, 1.2, 1.5);
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });
  const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
  hedge.position.set(x, 0.6, z);
  return hedge;
}

// Hedges along front wall sides
scene.add(createHedge(-20, 25, 6));
scene.add(createHedge(20, 25, 6));

// Benches
function createBench(x, z, rotY = 0) {
  const group = new THREE.Group();
  // Seat
  const seatGeo = new THREE.BoxGeometry(2, 0.1, 0.6);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = 0.5;
  group.add(seat);
  // Legs
  const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.5);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
  const leg1 = new THREE.Mesh(legGeo, metalMat);
  leg1.position.set(-0.8, 0.25, 0);
  group.add(leg1);
  const leg2 = new THREE.Mesh(legGeo, metalMat);
  leg2.position.set(0.8, 0.25, 0);
  group.add(leg2);
  // Backrest
  const backGeo = new THREE.BoxGeometry(2, 0.6, 0.08);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, 0.8, -0.26);
  back.rotation.x = 0.1;
  group.add(back);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// Benches facing building
scene.add(createBench(-16, 35, 0));
scene.add(createBench(16, 35, 0));

// Flag poles
function createFlagPole(x, z) {
  const group = new THREE.Group();
  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.08, 8, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 4;
  group.add(pole);
  // Flag
  const flagGeo = new THREE.PlaneGeometry(2, 1.2);
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    side: THREE.DoubleSide,
    roughness: 0.8
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(1, 7.2, 0);
  group.add(flag);
  group.position.set(x, 0, z);
  return group;
}

// Flag poles by entrance
scene.add(createFlagPole(-14, 28));
scene.add(createFlagPole(14, 28));

// Lamp posts
function createLampPost(x, z) {
  const group = new THREE.Group();
  // Post
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 4, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = 2;
  group.add(post);
  // Lamp head
  const lampGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffaa,
    emissiveIntensity: 0.5
  });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.y = 4.2;
  group.add(lamp);
  group.position.set(x, 0, z);
  return group;
}

// Lamp posts along walkway
scene.add(createLampPost(-6, 32));
scene.add(createLampPost(6, 32));
scene.add(createLampPost(-6, 42));
scene.add(createLampPost(6, 42));

// ====== STANDING ZODIAC AGENTS BY THE WALL ======
const standingAgents = [];

// Create 3 standing agents by the back wall
const dragon = createStandingZodiacAgent(-12, -18, 'dragon');
standingAgents.push(dragon);

const tiger = createStandingZodiacAgent(0, -18, 'tiger');
standingAgents.push(tiger);

const rabbit = createStandingZodiacAgent(12, -18, 'rabbit');
standingAgents.push(rabbit);

// Add name plates for standing agents
const standingLabels = ['Dragon', 'Tiger', 'Rabbit'];
standingAgents.forEach((agent, i) => {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(standingLabels[i], 128, 32);

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const labelGeo = new THREE.PlaneGeometry(1.2, 0.3);
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTexture,
    emissive: 0x1a1a2e,
    emissiveIntensity: 0.3
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(agent.group.position.x, 0.2, agent.group.position.z + 0.8);
  label.rotation.x = -Math.PI / 2;
  scene.add(label);
});

// ====== GLTF LOADER FOR ROBOT MODEL ======
const gltfLoader = new GLTFLoader();
const robotModelUrl = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
let robotModelTemplate = null;
let robotAnimations = null;

// Preload the robot model
let modelLoaded = false;
gltfLoader.load(robotModelUrl, (gltf) => {
  robotModelTemplate = gltf.scene;
  robotAnimations = gltf.animations;
  modelLoaded = true;
  console.log('Robot model loaded successfully');
  console.log('Available animations:', gltf.animations.map(a => a.name));

  // Refresh existing avatars to use the proper model
  refreshAvatarsWithModel();
}, undefined, (error) => {
  console.error('Error loading robot model:', error);
});

// Function to refresh avatars once model is loaded
function refreshAvatarsWithModel() {
  if (!modelLoaded) return;

  for (const [id, avatar] of avatars) {
    const zone = officeZones.get(avatar.zoneName);
    if (!zone) continue;

    const ws = zone.workstations[avatar.zoneWorkstationIndex];
    if (!ws) continue;

    // Remove old avatar and its zzzGroup
    scene.remove(avatar.model);
    if (avatar.zzzGroup) {
      scene.remove(avatar.zzzGroup);
    }

    // Create new avatar with proper model
    const animalType = avatar.animalType || 'cow';
    const robotAnimal = createRobotWithAnimalHead(ws.position.x, ws.position.z + 0.45, animalType);
    scene.add(robotAnimal.group);

    // Create new Zzz for sleeping
    const zzzGroup = createZzzGroup();
    zzzGroup.position.set(ws.position.x + 0.3, 2.0, ws.position.z + 0.45);
    zzzGroup.visible = false;
    scene.add(zzzGroup);

    // Start animation
    if (robotAnimal.actions && robotAnimal.actions['Idle']) {
      robotAnimal.actions['Idle'].play();
    }

    // Update avatar reference
    avatars.set(id, {
      ...robotAnimal,
      model: robotAnimal.group,
      instanceData: avatar.instanceData,
      workstationIndex: ws.index,
      zoneWorkstationIndex: avatar.zoneWorkstationIndex,
      zoneName: avatar.zoneName,
      status: avatar.status,
      typingOffset: avatar.typingOffset,
      currentAction: 'Idle',
      basePosition: { x: ws.position.x, z: ws.position.z + 0.45 },
      animalType,
      zzzGroup
    });

    // Set visibility based on status
    if (avatar.status === 'dormant') {
      robotAnimal.group.visible = false;
    }
  }
}

// ====== CREATE ZODIAC ANIMAL HEADS ======

// Dragon head (Chinese zodiac)
function createDragonHead() {
  const headGroup = new THREE.Group();

  // Main head - green/gold
  const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
  headGeo.scale(1.2, 1, 1.3);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.4, metalness: 0.3 });
  const head = new THREE.Mesh(headGeo, headMat);
  headGroup.add(head);

  // Snout
  const snoutGeo = new THREE.BoxGeometry(0.12, 0.08, 0.15);
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.5 });
  const snout = new THREE.Mesh(snoutGeo, snoutMat);
  snout.position.set(0, -0.02, 0.18);
  headGroup.add(snout);

  // Nostrils (breathing fire look)
  const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff4500, emissiveIntensity: 0.5 });
  const nostrilGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(-0.03, -0.02, 0.25);
  headGroup.add(leftNostril);
  const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  rightNostril.position.set(0.03, -0.02, 0.25);
  headGroup.add(rightNostril);

  // Eyes - fierce
  const eyeGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.3 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.1, 0.05, 0.1);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.1, 0.05, 0.1);
  headGroup.add(rightEye);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.03, 0.15, 8);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.5 });
  const leftHorn = new THREE.Mesh(hornGeo, hornMat);
  leftHorn.position.set(-0.1, 0.15, -0.05);
  leftHorn.rotation.z = 0.3;
  headGroup.add(leftHorn);
  const rightHorn = new THREE.Mesh(hornGeo, hornMat);
  rightHorn.position.set(0.1, 0.15, -0.05);
  rightHorn.rotation.z = -0.3;
  headGroup.add(rightHorn);

  // Spiky mane
  for (let i = 0; i < 5; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.02, 0.08, 6);
    const spike = new THREE.Mesh(spikeGeo, headMat);
    spike.position.set(0, 0.1 - i * 0.03, -0.1 - i * 0.02);
    spike.rotation.x = -0.5;
    headGroup.add(spike);
  }

  return headGroup;
}

// Tiger head (Chinese zodiac)
function createTigerHead() {
  const headGroup = new THREE.Group();

  // Main head - orange
  const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xFF8C00, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  headGroup.add(head);

  // White muzzle area
  const muzzleGeo = new THREE.SphereGeometry(0.1, 12, 12);
  const muzzleMat = new THREE.MeshStandardMaterial({ color: 0xFFFFF0, roughness: 0.6 });
  const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzle.position.set(0, -0.05, 0.1);
  muzzle.scale.set(1, 0.7, 0.8);
  headGroup.add(muzzle);

  // Nose
  const noseGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.02, 0.18);
  headGroup.add(nose);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.025, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.07, 0.04, 0.12);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.07, 0.04, 0.12);
  headGroup.add(rightEye);

  // Pupils
  const pupilGeo = new THREE.SphereGeometry(0.012, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.07, 0.04, 0.14);
  headGroup.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.07, 0.04, 0.14);
  headGroup.add(rightPupil);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
  const leftEar = new THREE.Mesh(earGeo, headMat);
  leftEar.position.set(-0.12, 0.12, 0);
  headGroup.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, headMat);
  rightEar.position.set(0.12, 0.12, 0);
  headGroup.add(rightEar);

  // Stripes (black markings)
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  for (let i = 0; i < 3; i++) {
    const stripeGeo = new THREE.BoxGeometry(0.02, 0.06, 0.01);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(-0.08 + i * 0.08, 0.08, 0.15);
    headGroup.add(stripe);
  }

  return headGroup;
}

// Rabbit head (Chinese zodiac)
function createRabbitHead() {
  const headGroup = new THREE.Group();

  // Main head - white/grey
  const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.7 });
  const head = new THREE.Mesh(headGeo, headMat);
  headGroup.add(head);

  // Long ears
  const earGeo = new THREE.CapsuleGeometry(0.03, 0.2, 8, 16);
  const earMat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.7 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.06, 0.22, -0.02);
  leftEar.rotation.z = 0.15;
  headGroup.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.06, 0.22, -0.02);
  rightEar.rotation.z = -0.15;
  headGroup.add(rightEar);

  // Inner ears (pink)
  const innerEarGeo = new THREE.CapsuleGeometry(0.015, 0.15, 8, 16);
  const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xFFB6C1 });
  const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  leftInnerEar.position.set(-0.06, 0.22, 0);
  leftInnerEar.rotation.z = 0.15;
  headGroup.add(leftInnerEar);
  const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  rightInnerEar.position.set(0.06, 0.22, 0);
  rightInnerEar.rotation.z = -0.15;
  headGroup.add(rightInnerEar);

  // Nose
  const noseGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xFFB6C1 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.02, 0.13);
  headGroup.add(nose);

  // Eyes (big and cute)
  const eyeGeo = new THREE.SphereGeometry(0.035, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.06, 0.02, 0.1);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.06, 0.02, 0.1);
  headGroup.add(rightEye);

  // Eye highlights
  const highlightGeo = new THREE.SphereGeometry(0.01, 8, 8);
  const highlightMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xFFFFFF, emissiveIntensity: 0.5 });
  const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat);
  leftHighlight.position.set(-0.055, 0.03, 0.13);
  headGroup.add(leftHighlight);
  const rightHighlight = new THREE.Mesh(highlightGeo, highlightMat);
  rightHighlight.position.set(0.065, 0.03, 0.13);
  headGroup.add(rightHighlight);

  // Cheeks (fluffy)
  const cheekGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xFFE4E1 });
  const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
  leftCheek.position.set(-0.1, -0.02, 0.08);
  headGroup.add(leftCheek);
  const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
  rightCheek.position.set(0.1, -0.02, 0.08);
  headGroup.add(rightCheek);

  return headGroup;
}

// ====== CREATE STANDING ZODIAC AGENT ======
function createStandingZodiacAgent(x, z, zodiacType) {
  const group = new THREE.Group();

  // Body - formal suit
  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2F4F4F, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.08, 0.25, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.08, 0.25, 0);
  group.add(rightLeg);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.15);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.3 });
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.08, 0.025, 0.02);
  group.add(leftShoe);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.08, 0.025, 0.02);
  group.add(rightShoe);

  // Arms (crossed or at sides)
  const armGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x2F4F4F, roughness: 0.5 });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.22, 0.75, 0);
  leftArm.rotation.z = 0.2;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.22, 0.75, 0);
  rightArm.rotation.z = -0.2;
  group.add(rightArm);

  // Create zodiac head based on type
  let animalHead;
  if (zodiacType === 'dragon') {
    animalHead = createDragonHead();
  } else if (zodiacType === 'tiger') {
    animalHead = createTigerHead();
  } else {
    animalHead = createRabbitHead();
  }

  animalHead.scale.set(3.5, 3.5, 3.5);
  animalHead.position.y = 1.4;
  group.add(animalHead);

  group.position.set(x, 0, z);
  scene.add(group);

  return { group, headGroup: animalHead, zodiacType };
}

// ====== CREATE HORSE HEAD ======
function createHorseHead() {
  const headGroup = new THREE.Group();

  // Horse head is more elongated
  const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
  headGeo.scale(1, 1.2, 1.5); // Elongated
  const headMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 }); // Brown
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.z = 0.05;
  headGroup.add(head);

  // Long snout/muzzle
  const snoutGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.15, 12);
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
  const snout = new THREE.Mesh(snoutGeo, snoutMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.2);
  headGroup.add(snout);

  // Nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(-0.03, -0.05, 0.27);
  headGroup.add(leftNostril);
  const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  rightNostril.position.set(0.03, -0.05, 0.27);
  headGroup.add(rightNostril);

  // Eyes (larger, more visible)
  const eyeWhiteGeo = new THREE.SphereGeometry(0.04, 12, 12);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  leftEyeWhite.position.set(-0.09, 0.06, 0.1);
  headGroup.add(leftEyeWhite);
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  rightEyeWhite.position.set(0.09, 0.06, 0.1);
  headGroup.add(rightEyeWhite);

  const pupilGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.09, 0.06, 0.135);
  headGroup.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.09, 0.06, 0.135);
  headGroup.add(rightPupil);

  // Eyelids (curved surface that covers eyes when sleeping)
  const eyelidGeo = new THREE.SphereGeometry(0.05, 16, 16);
  eyelidGeo.scale(1.2, 0.5, 0.8); // Wide oval to cover the eye fully
  const eyelidMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6, side: THREE.DoubleSide }); // Brown like horse
  const leftEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
  leftEyelid.position.set(-0.09, 0.06, 0.13); // In front of eye and pupil
  leftEyelid.visible = false;
  headGroup.add(leftEyelid);
  const rightEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
  rightEyelid.position.set(0.09, 0.06, 0.13);
  rightEyelid.visible = false;
  headGroup.add(rightEyelid);

  // Store eyelids in userData
  headGroup.userData.leftEyelid = leftEyelid;
  headGroup.userData.rightEyelid = rightEyelid;

  // Pointed ears
  const earGeo = new THREE.ConeGeometry(0.03, 0.1, 8);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.08, 0.15, 0);
  leftEar.rotation.z = 0.3;
  headGroup.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.08, 0.15, 0);
  rightEar.rotation.z = -0.3;
  headGroup.add(rightEar);

  // Inner ears (pink)
  const innerEarGeo = new THREE.ConeGeometry(0.015, 0.05, 8);
  const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
  const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  leftInnerEar.position.set(-0.08, 0.13, 0.015);
  leftInnerEar.rotation.z = 0.3;
  headGroup.add(leftInnerEar);
  const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  rightInnerEar.position.set(0.08, 0.13, 0.015);
  rightInnerEar.rotation.z = -0.3;
  headGroup.add(rightInnerEar);

  // Mane (hair on top)
  const maneGeo = new THREE.BoxGeometry(0.06, 0.15, 0.2);
  const maneMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }); // Dark mane
  const mane = new THREE.Mesh(maneGeo, maneMat);
  mane.position.set(0, 0.12, -0.05);
  headGroup.add(mane);

  // White blaze (stripe down face) - optional marking
  const blazeGeo = new THREE.PlaneGeometry(0.03, 0.12);
  const blazeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const blaze = new THREE.Mesh(blazeGeo, blazeMat);
  blaze.position.set(0, 0.02, 0.13);
  headGroup.add(blaze);

  return headGroup;
}

// ====== CREATE COW HEAD ======
function createCowHead() {
  const headGroup = new THREE.Group();

  // Main head (white with spots)
  const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  headGroup.add(head);

  // Snout/muzzle (pink/tan)
  const snoutGeo = new THREE.SphereGeometry(0.1, 12, 12);
  snoutGeo.scale(1, 0.7, 0.8);
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.7 });
  const snout = new THREE.Mesh(snoutGeo, snoutMat);
  snout.position.set(0, -0.04, 0.1);
  headGroup.add(snout);

  // Nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.018, 8, 8);
  const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(-0.035, -0.04, 0.17);
  headGroup.add(leftNostril);
  const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  rightNostril.position.set(0.035, -0.04, 0.17);
  headGroup.add(rightNostril);

  // Eyes (larger)
  const eyeWhiteGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  leftEyeWhite.position.set(-0.08, 0.05, 0.1);
  headGroup.add(leftEyeWhite);
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  rightEyeWhite.position.set(0.08, 0.05, 0.1);
  headGroup.add(rightEyeWhite);

  const pupilGeo = new THREE.SphereGeometry(0.022, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.08, 0.05, 0.14);
  headGroup.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.08, 0.05, 0.14);
  headGroup.add(rightPupil);

  // Eyelids (curved surface that covers eyes when sleeping)
  const eyelidGeo = new THREE.SphereGeometry(0.055, 16, 16);
  eyelidGeo.scale(1.2, 0.5, 0.8); // Wide oval to cover the eye fully
  const eyelidMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
  const leftEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
  leftEyelid.position.set(-0.08, 0.05, 0.13); // In front of eye and pupil
  leftEyelid.visible = false; // Hidden when awake
  headGroup.add(leftEyelid);
  const rightEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
  rightEyelid.position.set(0.08, 0.05, 0.13);
  rightEyelid.visible = false;
  headGroup.add(rightEyelid);

  // Store eyelids in userData for animation access
  headGroup.userData.leftEyelid = leftEyelid;
  headGroup.userData.rightEyelid = rightEyelid;

  // Ears
  const earGeo = new THREE.SphereGeometry(0.05, 8, 8);
  earGeo.scale(1, 0.5, 0.3);
  const earMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.15, 0.04, 0);
  leftEar.rotation.z = 0.3;
  headGroup.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.15, 0.04, 0);
  rightEar.rotation.z = -0.3;
  headGroup.add(rightEar);

  // Inner ears (pink)
  const innerEarGeo = new THREE.SphereGeometry(0.025, 8, 8);
  innerEarGeo.scale(1, 0.5, 0.3);
  const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
  const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  leftInnerEar.position.set(-0.15, 0.04, 0.015);
  leftInnerEar.rotation.z = 0.3;
  headGroup.add(leftInnerEar);
  const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
  rightInnerEar.position.set(0.15, 0.04, 0.015);
  rightInnerEar.rotation.z = -0.3;
  headGroup.add(rightInnerEar);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.022, 0.09, 8);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xccaa77, roughness: 0.4 });
  const leftHorn = new THREE.Mesh(hornGeo, hornMat);
  leftHorn.position.set(-0.08, 0.15, 0);
  leftHorn.rotation.z = 0.4;
  headGroup.add(leftHorn);
  const rightHorn = new THREE.Mesh(hornGeo, hornMat);
  rightHorn.position.set(0.08, 0.15, 0);
  rightHorn.rotation.z = -0.4;
  headGroup.add(rightHorn);

  // Black spots on head
  const spotGeo = new THREE.SphereGeometry(0.04, 8, 8);
  spotGeo.scale(1, 1, 0.3);
  const spotMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const spot1 = new THREE.Mesh(spotGeo, spotMat);
  spot1.position.set(-0.1, 0.08, 0.06);
  headGroup.add(spot1);
  const spot2 = new THREE.Mesh(spotGeo.clone(), spotMat);
  spot2.scale.set(0.7, 0.7, 1);
  spot2.position.set(0.08, 0.1, 0.04);
  headGroup.add(spot2);

  return headGroup;
}

// ====== CREATE ROBOT WITH ANIMAL HEAD ======
// ====== SPEECH BUBBLE ======
function createSpeechBubble() {
  const group = new THREE.Group();

  // Canvas for dynamic text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Initial render - clean dark background
  ctx.fillStyle = 'rgba(30, 35, 45, 0.95)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 20);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Speech bubble panel - slightly larger
  const bubbleGeo = new THREE.PlaneGeometry(2.2, 0.55);
  const bubbleMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  group.add(bubble);

  // Tail pointing down - small triangle matching bubble color
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(-0.08, 0.15);
  tailShape.lineTo(0.08, 0.15);
  tailShape.closePath();
  const tailGeo = new THREE.ShapeGeometry(tailShape);
  const tailMat = new THREE.MeshBasicMaterial({
    color: 0x1e232d,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.y = -0.35;
  tail.position.z = 0.001; // Slight offset to prevent z-fighting
  group.add(tail);

  // Position above agent head
  group.position.set(0, 3.2, 0);
  group.visible = false; // Hidden by default

  return { group, canvas, ctx, texture };
}

function updateSpeechBubble(speechBubble, text) {
  if (!speechBubble || !text) {
    if (speechBubble) speechBubble.group.visible = false;
    return;
  }

  const { canvas, ctx, texture, group } = speechBubble;

  // Clear canvas
  ctx.clearRect(0, 0, 512, 128);

  // Clean dark background with rounded corners
  ctx.fillStyle = 'rgba(30, 35, 45, 0.95)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 20);
  ctx.fill();

  // Subtle inner shadow/glow effect
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(60, 70, 90, 0.3)');
  gradient.addColorStop(0.5, 'rgba(30, 35, 45, 0)');
  gradient.addColorStop(1, 'rgba(20, 25, 35, 0.3)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 20);
  ctx.fill();

  // White text with slight shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Truncate text if needed
  let displayText = text;
  if (displayText.length > 35) {
    displayText = displayText.substring(0, 32) + '...';
  }
  ctx.fillText(displayText, 256, 64);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  texture.needsUpdate = true;
  group.visible = true;
}

function createRobotWithAnimalHead(x, z, animalType = 'cow') {
  const group = new THREE.Group();

  // Create the appropriate animal head
  const animalHead = animalType === 'horse' ? createHorseHead() : createCowHead();

  if (!robotModelTemplate) {
    // Fallback: create a simple placeholder if model not loaded yet
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.8, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x4a90d9 })
    );
    placeholder.position.y = 0.5;
    group.add(placeholder);

    animalHead.position.y = 2.0; // Raised higher
    animalHead.scale.set(5.0, 5.0, 5.0); // Big head!
    group.add(animalHead);

    // Add speech bubble (placeholder case)
    const speechBubble = createSpeechBubble();
    group.add(speechBubble.group);

    group.position.set(x, 0, z);
    group.rotation.y = Math.PI;

    return { group, headGroup: animalHead, mixer: null, actions: {}, animalType, speechBubble };
  }

  // Clone the robot model properly using SkeletonUtils for skeletal meshes
  // Regular .clone() doesn't properly clone bones/skeleton, causing floating hands
  const robot = SkeletonUtils.clone(robotModelTemplate);
  robot.scale.set(0.7, 0.7, 0.7); // Bigger avatars!

  // Find and hide the robot's head meshes
  const headMeshNames = ['Head_4', 'Head_3', 'Head_2', 'Head_1', 'Head'];
  robot.traverse((child) => {
    // Hide head-related meshes
    if (child.isMesh && (
      headMeshNames.includes(child.name) ||
      child.name.toLowerCase().includes('head') ||
      child.name.toLowerCase().includes('eye') ||
      child.name.toLowerCase().includes('face')
    )) {
      child.visible = false;
    }
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  group.add(robot);

  // Add animal head - positioned on top of robot body (adjusted for larger scale)
  animalHead.scale.set(5.0, 5.0, 5.0); // Bigger head for bigger robot!
  animalHead.position.set(0, 2.0, 0); // Raised higher for 0.7 scale robot
  group.add(animalHead);

  // Setup animation mixer
  const mixer = new THREE.AnimationMixer(robot);
  const actions = {};

  if (robotAnimations) {
    robotAnimations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      actions[clip.name] = action;
    });
  }

  // Add speech bubble
  const speechBubble = createSpeechBubble();
  group.add(speechBubble.group);

  group.position.set(x, 0, z);
  group.rotation.y = Math.PI;

  return { group, headGroup: animalHead, robot, mixer, actions, animalType, speechBubble };
}

// ====== FLOOR NAME PLATE CREATION ======
function createNameCard(text, x, y, z) {
  const group = new THREE.Group();

  // Floor plate with text (using canvas texture) - BIG and on the floor
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Background - dark with glow effect
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 1024, 256);

  // Border - glowing blue
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 1008, 240);

  // Inner glow
  ctx.strokeStyle = '#6ab0f9';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 992, 224);

  // Text - MASSIVE FONT
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Truncate text if too long
  let displayText = text;
  if (text.length > 14) {
    displayText = text.substring(0, 13) + '...';
  }
  ctx.fillText(displayText, 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;

  // Large floor plate
  const cardGeo = new THREE.PlaneGeometry(3.0, 0.8);
  const cardMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.3,
    emissive: 0x1a1a2e,
    emissiveIntensity: 0.3,
    // Use polygon offset to prevent z-fighting with floor
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    depthWrite: true
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.rotation.x = -Math.PI / 2; // Flat on floor
  card.position.y = 0.1; // Higher above floor to prevent z-fighting
  card.renderOrder = 1; // Render after floor
  group.add(card);

  group.position.set(x, y, z);
  scene.add(group);

  return { group, canvas, ctx, texture, card };
}

function updateNameCard(nameCard, text) {
  const { canvas, ctx, texture } = nameCard;

  // Clear and redraw
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 1008, 240);

  ctx.strokeStyle = '#6ab0f9';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 992, 224);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let displayText = text || 'Empty';
  if (displayText.length > 14) {
    displayText = displayText.substring(0, 13) + '...';
  }
  ctx.fillText(displayText, 512, 128);

  texture.needsUpdate = true;
}

// ====== OFFICE ZONES ======
const officeZones = new Map(); // Map of projectName -> zone data
const workstations = [];
const allWorkstations = []; // All created workstations

// Zone colors for different projects
const zoneColors = [
  0x3a5f8a, // Blue
  0x8a3a5f, // Burgundy
  0x5f8a3a, // Green
  0x8a5f3a, // Orange
  0x5f3a8a, // Purple
  0x3a8a5f, // Teal
];

// Create a floor zone with boundary
function createOfficeZone(projectName, zoneIndex, instanceCount) {
  const zoneWidth = 10;  // Wider zone but fits within walls
  const zoneDepth = 7;   // Deeper to include name card
  const zonesPerRow = 3;

  const row = Math.floor(zoneIndex / zonesPerRow);
  const col = zoneIndex % zonesPerRow;

  // Position zones to stay within walls (x: -24 to 24) - 1.2x factory
  const zoneStartX = -14; // First zone center at -14
  const zoneStartZ = 8;   // Start further forward (positive Z)

  const zoneX = zoneStartX + col * (zoneWidth + 4); // -14, 0, 14
  const zoneZ = zoneStartZ - row * (zoneDepth + 3); // 8, -2, -12...

  const group = new THREE.Group();

  // Floor panel for zone
  const floorGeo = new THREE.PlaneGeometry(zoneWidth, zoneDepth);
  const zoneColor = zoneColors[zoneIndex % zoneColors.length];
  const floorMat = new THREE.MeshStandardMaterial({
    color: zoneColor,
    roughness: 0.8,
    transparent: true,
    opacity: 0.3,
    // Use polygon offset to prevent z-fighting with main floor
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(zoneX, 0.03, zoneZ); // Slightly above main floor
  floor.receiveShadow = true;
  scene.add(floor);

  // Zone border
  const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(zoneWidth, 0.1, zoneDepth));
  const borderMat = new THREE.LineBasicMaterial({ color: zoneColor, linewidth: 2 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.position.set(zoneX, 0.05, zoneZ);
  scene.add(border);

  // Create workstations within zone (up to 4 per zone)
  const zoneWorkstations = [];
  const maxWorkstationsInZone = Math.min(instanceCount, 4);
  const wsPositions = [
    { x: -3, z: 1.5 },    // Spread out, centered in zone
    { x: 3, z: 1.5 },
    { x: -3, z: -1 },
    { x: 3, z: -1 },
  ];

  for (let i = 0; i < maxWorkstationsInZone; i++) {
    const wsX = zoneX + wsPositions[i].x;
    const wsZ = zoneZ + wsPositions[i].z;
    const ws = createWorkstation(wsX, wsZ, allWorkstations.length);
    zoneWorkstations.push(ws);
    allWorkstations.push(ws);
  }

  return {
    projectName,
    zoneIndex,
    zoneX,
    zoneZ,
    color: zoneColor,
    workstations: zoneWorkstations,
    floor
  };
}

function createCoffeeMug(x, y, z) {
  const group = new THREE.Group();

  // Mug body - 2x bigger
  const mugGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.16, 16);
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const mug = new THREE.Mesh(mugGeo, mugMat);
  mug.position.y = 0.08;
  group.add(mug);

  // Handle - 2x bigger
  const handleGeo = new THREE.TorusGeometry(0.05, 0.016, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeo, mugMat);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.11, 0.08, 0);
  group.add(handle);

  // Coffee liquid - 2x bigger
  const coffeeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16);
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x4a2c2a, roughness: 0.2 });
  const coffee = new THREE.Mesh(coffeeGeo, coffeeMat);
  coffee.position.y = 0.15;
  group.add(coffee);

  // Steam - 2x bigger
  for (let i = 0; i < 3; i++) {
    const steamGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const steamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    const steam = new THREE.Mesh(steamGeo, steamMat);
    steam.position.set((Math.random() - 0.5) * 0.04, 0.2 + i * 0.04, (Math.random() - 0.5) * 0.04);
    steam.userData.steamIndex = i;
    group.add(steam);
  }

  group.position.set(x, y, z);
  group.visible = false;
  scene.add(group);
  return group;
}

function createWorkstation(x, z, index) {
  const group = new THREE.Group();

  // Desk
  const deskGeo = new THREE.BoxGeometry(2, 0.05, 1);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.position.y = 0.75;
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);

  // Desk legs
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
  [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.375, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // Laptop base - 2x bigger
  const laptopBaseGeo = new THREE.BoxGeometry(1.0, 0.04, 0.7);
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.3 });
  const laptopBase = new THREE.Mesh(laptopBaseGeo, laptopMat);
  laptopBase.position.set(0, 0.79, -0.1);
  group.add(laptopBase);

  // Laptop screen - 2x bigger
  const laptopScreenGroup = new THREE.Group();
  const screenGeo = new THREE.BoxGeometry(1.0, 0.7, 0.03);
  const screen = new THREE.Mesh(screenGeo, laptopMat);
  screen.position.y = 0.35;
  screen.position.z = -0.015;
  laptopScreenGroup.add(screen);

  // Display - 2x bigger
  const displayGeo = new THREE.PlaneGeometry(0.9, 0.6);
  const displayMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: 0x1a1a2e, emissiveIntensity: 0 });
  const display = new THREE.Mesh(displayGeo, displayMat);
  display.position.set(0, 0.35, 0.002);
  laptopScreenGroup.add(display);

  // Code lines - 2x bigger
  const codeLinesMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const codeLines = [];
  for (let i = 0; i < 5; i++) {
    const lineGeo = new THREE.PlaneGeometry(0.6 + Math.random() * 0.2, 0.03);
    const line = new THREE.Mesh(lineGeo, codeLinesMat.clone());
    line.position.set(-0.1 + Math.random() * 0.1, 0.5 - i * 0.1, 0.004);
    laptopScreenGroup.add(line);
    codeLines.push(line);
  }

  laptopScreenGroup.position.set(0, 0.79, -0.45);
  laptopScreenGroup.rotation.x = -Math.PI / 6;
  group.add(laptopScreenGroup);

  // Keyboard - 2x bigger
  const keyboardGeo = new THREE.PlaneGeometry(0.8, 0.4);
  const keyboardMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const keyboard = new THREE.Mesh(keyboardGeo, keyboardMat);
  keyboard.rotation.x = -Math.PI / 2;
  keyboard.position.set(0, 0.801, 0);
  group.add(keyboard);

  // Chair
  const chairGroup = new THREE.Group();
  const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const seat = new THREE.Mesh(seatGeo, chairMat);
  seat.position.y = 0.45;
  chairGroup.add(seat);

  const backrestGeo = new THREE.BoxGeometry(0.5, 0.5, 0.08);
  const backrest = new THREE.Mesh(backrestGeo, chairMat);
  backrest.position.set(0, 0.7, 0.21);
  chairGroup.add(backrest);

  const chairLegGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
  const chairLeg = new THREE.Mesh(chairLegGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }));
  chairLeg.position.y = 0.225;
  chairGroup.add(chairLeg);

  chairGroup.position.set(0, 0, 0.8);
  group.add(chairGroup);

  // Status indicator
  const indicatorGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x888888, emissiveIntensity: 0.3 });
  const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
  indicator.position.set(0.8, 0.83, 0);
  group.add(indicator);

  group.position.set(x, 0, z);
  scene.add(group);

  // Coffee mug
  const coffeeMug = createCoffeeMug(x + 0.6, 0.78, z + 0.1);

  // Name card - on the floor in front of desk (closer to stay in zone)
  const nameCard = createNameCard('Empty', x, 0, z + 1.2);

  // Beach chair removed - idle agents lie on floor

  // Spotlight for night mode - illuminates only active agents
  const spotlight = new THREE.SpotLight(0xffffee, 0, 8, Math.PI / 4, 0.5, 1);
  spotlight.position.set(x, 4, z);
  spotlight.target.position.set(x, 0, z + 0.5);
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 512;
  spotlight.shadow.mapSize.height = 512;
  spotlight.visible = false;
  scene.add(spotlight);
  scene.add(spotlight.target);

  return {
    group,
    display,
    displayMat,
    codeLines,
    indicator,
    laptopScreenGroup,
    coffeeMug,
    nameCard,
    spotlight,
    position: { x, z },
    index
  };
}

// Create a beach/lounge chair for sleeping agents
function createBeachChair() {
  const group = new THREE.Group();

  // Chair frame material (wood)
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
  // Fabric material (striped look - orange)
  const fabricMat = new THREE.MeshStandardMaterial({ color: 0xFF6B35, roughness: 0.9 });

  // Back rest (angled)
  const backGeo = new THREE.BoxGeometry(0.8, 0.05, 1.0);
  const back = new THREE.Mesh(backGeo, fabricMat);
  back.position.set(0, 0.4, -0.3);
  back.rotation.x = -Math.PI / 5; // Angled back
  group.add(back);

  // Seat
  const seatGeo = new THREE.BoxGeometry(0.8, 0.05, 0.8);
  const seat = new THREE.Mesh(seatGeo, fabricMat);
  seat.position.set(0, 0.25, 0.4);
  group.add(seat);

  // Leg rest
  const legRestGeo = new THREE.BoxGeometry(0.8, 0.05, 0.6);
  const legRest = new THREE.Mesh(legRestGeo, fabricMat);
  legRest.position.set(0, 0.2, 1.0);
  legRest.rotation.x = Math.PI / 12; // Slight angle
  group.add(legRest);

  // Frame legs
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
  const legPositions = [
    [-0.35, 0.15, -0.6],
    [0.35, 0.15, -0.6],
    [-0.35, 0.1, 0.8],
    [0.35, 0.1, 0.8]
  ];
  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(...pos);
    group.add(leg);
  });

  // Arm rests
  const armGeo = new THREE.BoxGeometry(0.08, 0.05, 1.4);
  [-0.44, 0.44].forEach(xPos => {
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.position.set(xPos, 0.35, 0.3);
    group.add(arm);
  });

  // Drink on side table
  const drinkGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.12, 8);
  const drinkMat = new THREE.MeshStandardMaterial({ color: 0x00CED1, transparent: true, opacity: 0.8 });
  const drink = new THREE.Mesh(drinkGeo, drinkMat);
  drink.position.set(0.6, 0.35, 0.3);
  group.add(drink);

  // Small side table for drink
  const tableGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 8);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.set(0.6, 0.28, 0.3);
  group.add(table);

  const tableLegs = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8);
  const tableLeg = new THREE.Mesh(tableLegs, tableMat);
  tableLeg.position.set(0.6, 0.14, 0.3);
  group.add(tableLeg);

  return group;
}

// Workstations are now created dynamically within office zones
// No static workstation creation needed

// ====== AVATAR MANAGEMENT ======
const avatars = new Map();

function createAvatar(instanceData, workstationIndex) {
  const ws = workstations[workstationIndex];
  if (!ws) return null;

  // Alternate between cow and horse based on workstation index
  const animalType = workstationIndex % 2 === 0 ? 'cow' : 'horse';

  // Position avatar closer to desk so hands can reach keyboard
  const robotAnimal = createRobotWithAnimalHead(ws.position.x, ws.position.z + 0.45, animalType);
  scene.add(robotAnimal.group);

  // Start with Idle animation if available
  if (robotAnimal.actions && robotAnimal.actions['Idle']) {
    robotAnimal.actions['Idle'].play();
  }

  return {
    ...robotAnimal,
    model: robotAnimal.group,
    instanceData,
    workstationIndex,
    status: 'idle',
    typingOffset: Math.random() * Math.PI * 2,
    currentAction: 'Idle',
    basePosition: { x: ws.position.x, z: ws.position.z + 0.45 },
    animalType
  };
}

function updateWorkstationForStatus(workstation, status, projectName) {
  if (!workstation) return;

  // Update name card
  updateNameCard(workstation.nameCard, projectName || 'Empty');

  // Indicator colors
  const colors = {
    active: { color: 0x00ff00, emissive: 0x00ff00 },
    idle: { color: 0xffff00, emissive: 0xffff00 },
    dormant: { color: 0xff0000, emissive: 0xff0000 },
    empty: { color: 0x888888, emissive: 0x888888 }
  };

  const statusColor = colors[status] || colors.empty;
  workstation.indicator.material.color.setHex(statusColor.color);
  workstation.indicator.material.emissive.setHex(statusColor.emissive);
  workstation.indicator.material.emissiveIntensity = status === 'active' ? 1 : 0.5;

  // Laptop screen state
  if (status === 'active') {
    workstation.displayMat.color.setHex(0x1a2a3a);
    workstation.displayMat.emissive.setHex(0x2244aa);
    workstation.displayMat.emissiveIntensity = 0.8;
    workstation.codeLines.forEach(line => {
      line.material.emissiveIntensity = 0.8;
      line.material.opacity = 1;
    });
    // Coffee mug visibility controlled by animation loop
  } else if (status === 'idle') {
    workstation.displayMat.color.setHex(0x111111);
    workstation.displayMat.emissive.setHex(0x000000);
    workstation.displayMat.emissiveIntensity = 0;
    workstation.codeLines.forEach(line => {
      line.material.emissiveIntensity = 0;
      line.material.opacity = 0;
    });
    // Coffee mug visibility controlled by animation loop
  } else {
    workstation.displayMat.color.setHex(0x111111);
    workstation.displayMat.emissive.setHex(0x000000);
    workstation.displayMat.emissiveIntensity = 0;
    workstation.codeLines.forEach(line => {
      line.material.emissiveIntensity = 0;
      line.material.opacity = 0;
    });
    workstation.coffeeMug.visible = false;
  }
}

// ====== API FETCHING ======
// API URL is relative - Vite proxies /api to backend
const API_URL = '';

async function fetchClaudeInstances() {
  try {
    const response = await fetch(`${API_URL}/api/factory/claude-instances`);
    if (!response.ok) throw new Error('API not available');

    const data = await response.json();
    updateAvatars(data.instances);
    updateInfoPanel(data);
    updateTokenDistribution(data.instances, data.totalSessionTokens);

  } catch (error) {
    console.error('Error fetching Claude instances:', error);
    updateStatus('API not available. Run: npm run server');
  }
}

function updateAvatars(instances) {
  // Group instances by project name
  const projectGroups = new Map();
  instances.forEach(instance => {
    const projectName = instance.projectName || 'Unknown';
    if (!projectGroups.has(projectName)) {
      projectGroups.set(projectName, []);
    }
    projectGroups.get(projectName).push(instance);
  });

  // Track which zones and workstations are in use
  const activeProjects = new Set(projectGroups.keys());
  const usedWorkstations = new Set();

  // Sort projects alphabetically for deterministic zone positioning
  const sortedProjects = Array.from(projectGroups.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  // Check if project set has changed - if so, recreate all zones
  const existingProjects = Array.from(officeZones.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const projectsChanged = sortedProjects.length !== existingProjects.length ||
    sortedProjects.some((p, i) => p !== existingProjects[i]);

  if (projectsChanged) {
    // Remove old zones from scene
    for (const [projectName, zone] of officeZones) {
      scene.remove(zone.group);
    }
    officeZones.clear();

    // Create zones in alphabetical order
    sortedProjects.forEach((projectName, idx) => {
      const projectInstances = projectGroups.get(projectName);
      const zone = createOfficeZone(projectName, idx, projectInstances.length);
      officeZones.set(projectName, zone);
    });

    // Clear and reassign all avatars to new zones
    for (const [id, avatar] of avatars) {
      scene.remove(avatar.model);
      // Also remove the zzzGroup that was added separately to the scene
      if (avatar.zzzGroup) {
        scene.remove(avatar.zzzGroup);
      }
    }
    avatars.clear();
  }

  // Update avatars within each zone
  for (const [projectName, projectInstances] of projectGroups) {
    const zone = officeZones.get(projectName);
    if (!zone) continue;

    // Assign instances to workstations in this zone
    projectInstances.forEach((instance, idx) => {
      const existingAvatar = avatars.get(instance.id);

      if (existingAvatar) {
        // Update existing avatar
        existingAvatar.status = instance.status;
        existingAvatar.instanceData = instance;

        if (instance.status === 'dormant') {
          existingAvatar.model.visible = false;
        } else {
          existingAvatar.model.visible = true;
        }

        const ws = zone.workstations[existingAvatar.zoneWorkstationIndex];
        if (ws) {
          usedWorkstations.add(ws.index);
          updateWorkstationForStatus(ws, instance.status, instance.projectName);
        }
      } else {
        // Create new avatar in this zone
        if (idx < zone.workstations.length) {
          const ws = zone.workstations[idx];
          const avatar = createAvatarAtWorkstation(instance, ws, idx);
          if (avatar) {
            avatar.status = instance.status;
            avatar.instanceData = instance;
            avatar.zoneName = projectName;
            avatar.zoneWorkstationIndex = idx;
            avatars.set(instance.id, avatar);

            if (instance.status === 'dormant') {
              avatar.model.visible = false;
            }

            usedWorkstations.add(ws.index);
            updateWorkstationForStatus(ws, instance.status, instance.projectName);
          }
        }
      }
    });
  }

  // Remove avatars for instances that no longer exist
  for (const [id, avatar] of avatars) {
    const stillExists = instances.find(i => i.id === id);
    if (!stillExists) {
      scene.remove(avatar.model);
      // Also remove the zzzGroup that was added separately to the scene
      if (avatar.zzzGroup) {
        scene.remove(avatar.zzzGroup);
      }
      avatars.delete(id);
    }
  }

  // Reset unused workstations in active zones
  for (const [projectName, zone] of officeZones) {
    zone.workstations.forEach(ws => {
      if (!usedWorkstations.has(ws.index)) {
        updateWorkstationForStatus(ws, 'empty', null);
      }
    });
  }
}

// Create floating "Zzz" for sleeping agents
function createZzzGroup() {
  const group = new THREE.Group();

  // Create "Z" letters at different sizes and positions (3x bigger)
  const zSizes = [0.45, 0.36, 0.30];
  const zOffsets = [
    { x: 0, y: 0, z: 0 },
    { x: 0.45, y: 0.5, z: 0 },
    { x: 0.75, y: 0.9, z: 0 }
  ];

  zSizes.forEach((size, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4a90d9';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8 - i * 0.2
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size, 1);
    sprite.position.set(zOffsets[i].x, zOffsets[i].y, zOffsets[i].z);
    group.add(sprite);
  });

  return group;
}

function createAvatarAtWorkstation(instanceData, workstation, zoneWsIndex) {
  if (!workstation) return null;

  // Alternate between cow and horse
  const animalType = zoneWsIndex % 2 === 0 ? 'cow' : 'horse';

  const robotAnimal = createRobotWithAnimalHead(
    workstation.position.x,
    workstation.position.z + 0.45,
    animalType
  );
  scene.add(robotAnimal.group);

  // Create Zzz for sleeping
  const zzzGroup = createZzzGroup();
  zzzGroup.position.set(workstation.position.x + 0.3, 2.0, workstation.position.z + 0.45);
  zzzGroup.visible = false; // Hidden by default
  scene.add(zzzGroup);

  if (robotAnimal.actions && robotAnimal.actions['Idle']) {
    robotAnimal.actions['Idle'].play();
  }

  return {
    ...robotAnimal,
    model: robotAnimal.group,
    instanceData,
    workstationIndex: workstation.index,
    status: 'idle',
    typingOffset: Math.random() * Math.PI * 2,
    currentAction: 'Idle',
    basePosition: { x: workstation.position.x, z: workstation.position.z + 0.45 },
    animalType,
    zzzGroup // Add Zzz reference
  };
}

function updateInfoPanel(data) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <strong>AgentMux Factory</strong><br>
    <span style="color: #0f0;">● Active: ${data.activeCount}</span> |
    <span style="color: #ff0;">● Idle: ${data.idleCount}</span> |
    <span style="color: #f00;">● Dormant: ${data.dormantCount}</span><br>
    <small>Total: ${data.totalInstances} instances</small>
  `;
}

// Colors for different projects in the distribution bar
const distColors = [
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#f39c12', // Orange
  '#1abc9c', // Teal
  '#e91e63', // Pink
  '#00bcd4', // Cyan
];

function updateTokenDistribution(instances, totalTokens) {
  const distDiv = document.getElementById('token-dist-content');

  if (!totalTokens || totalTokens === 0) {
    distDiv.innerHTML = '<span style="color: #666;">No token data available</span>';
    return;
  }

  // Aggregate tokens by project name
  const projectTokens = new Map();
  instances.forEach(instance => {
    const name = instance.projectName || 'Unknown';
    const current = projectTokens.get(name) || 0;
    projectTokens.set(name, current + (instance.sessionTokens || 0));
  });

  // Sort by token count descending
  const sorted = Array.from(projectTokens.entries())
    .sort((a, b) => b[1] - a[1]);

  // Build bar segments
  let barHtml = '<div class="dist-bar-container">';
  sorted.forEach(([name, tokens], idx) => {
    const percent = (tokens / totalTokens) * 100;
    if (percent > 0.5) { // Only show segments > 0.5%
      const color = distColors[idx % distColors.length];
      barHtml += `<div class="dist-bar-segment" style="width: ${percent}%; background: ${color};" title="${name}: ${percent.toFixed(1)}%"></div>`;
    }
  });
  barHtml += '</div>';

  // Build legend
  let legendHtml = '<div class="dist-legend">';
  sorted.forEach(([name, tokens], idx) => {
    const percent = Math.round((tokens / totalTokens) * 100);
    const color = distColors[idx % distColors.length];
    const formattedTokens = tokens >= 1000000
      ? (tokens / 1000000).toFixed(1) + 'M'
      : tokens >= 1000
        ? (tokens / 1000).toFixed(0) + 'K'
        : tokens.toString();

    legendHtml += `
      <div class="dist-item">
        <div class="dist-color" style="background: ${color};"></div>
        <span class="dist-name">${name}</span>
        <span class="dist-percent">${formattedTokens} (${percent}%)</span>
      </div>
    `;
  });
  legendHtml += '</div>';

  distDiv.innerHTML = barHtml + legendHtml;
}

function updateStatus(message) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `<strong>AgentMux Factory</strong><br>${message}`;
}

// Initial fetch
fetchClaudeInstances();
setInterval(fetchClaudeInstances, 3000);

// ====== CONVEYOR BELT ======
const conveyorGroup = new THREE.Group();
const conveyorGeo = new THREE.BoxGeometry(14, 0.3, 1.5);
const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
const conveyor = new THREE.Mesh(conveyorGeo, conveyorMat);
conveyor.position.set(0, 1, -14);
conveyor.castShadow = true;
conveyorGroup.add(conveyor);

const beltGeo = new THREE.PlaneGeometry(13.8, 1.3);
const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const belt = new THREE.Mesh(beltGeo, beltMat);
belt.rotation.x = -Math.PI / 2;
belt.position.set(0, 1.16, -14);
conveyorGroup.add(belt);

for (let i = -3; i <= 3; i++) {
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 });
  const leg = new THREE.Mesh(legGeo, legMat);
  leg.position.set(i * 2, 0.5, -14);
  leg.castShadow = true;
  conveyorGroup.add(leg);
}
scene.add(conveyorGroup);

const boxes = [];
for (let i = 0; i < 4; i++) {
  const boxGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7);
  const boxMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random() * 0.3, 0.7, 0.5), roughness: 0.6 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(-5 + i * 3, 1.4, -14);
  box.castShadow = true;
  boxes.push(box);
  scene.add(box);
}

// ====== INDUSTRIAL MACHINERY ======
function createMachine(x, z, height, color) {
  const group = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(2, height, 2);
  const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = height / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const panelGeo = new THREE.BoxGeometry(0.8, 0.5, 0.1);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(0, height * 0.7, 1.05);
  group.add(panel);

  [0x00ff00, 0xffff00, 0xff0000].forEach((col, i) => {
    const lightGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 });
    const indicator = new THREE.Mesh(lightGeo, lightMat);
    indicator.position.set(-0.2 + i * 0.2, height * 0.7 + 0.15, 1.1);
    group.add(indicator);
  });

  group.position.set(x, 0, z);
  scene.add(group);
}

createMachine(-12, -10, 3, 0x4a6fa5);
createMachine(12, -10, 3, 0x6a8fc5);

// ====== CORPORATE DECORATIONS ======

// Potted plant function
function createPottedPlant(x, z, size = 1) {
  const group = new THREE.Group();

  // Pot
  const potGeo = new THREE.CylinderGeometry(0.2 * size, 0.15 * size, 0.3 * size, 8);
  const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.15 * size;
  group.add(pot);

  // Dirt
  const dirtGeo = new THREE.CylinderGeometry(0.18 * size, 0.18 * size, 0.05, 8);
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
  const dirt = new THREE.Mesh(dirtGeo, dirtMat);
  dirt.position.y = 0.28 * size;
  group.add(dirt);

  // Plant leaves (multiple cones for bushy look)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  for (let i = 0; i < 5; i++) {
    const leafGeo = new THREE.ConeGeometry(0.15 * size, 0.5 * size, 6);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = 0.5 * size + Math.random() * 0.2;
    leaf.position.x = (Math.random() - 0.5) * 0.15;
    leaf.position.z = (Math.random() - 0.5) * 0.15;
    leaf.rotation.x = (Math.random() - 0.5) * 0.3;
    leaf.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(leaf);
  }

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

// Water cooler function
function createWaterCooler(x, z) {
  const group = new THREE.Group();

  // Base/stand
  const baseGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xd3d3d3, roughness: 0.3 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.4;
  group.add(base);

  // Water jug (blue tinted)
  const jugGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.5, 12);
  const jugMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.7 });
  const jug = new THREE.Mesh(jugGeo, jugMat);
  jug.position.y = 1.05;
  group.add(jug);

  // Dispenser area
  const dispenserGeo = new THREE.BoxGeometry(0.3, 0.15, 0.15);
  const dispenserMat = new THREE.MeshStandardMaterial({ color: 0x404040 });
  const dispenser = new THREE.Mesh(dispenserGeo, dispenserMat);
  dispenser.position.set(0, 0.6, 0.2);
  group.add(dispenser);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

// Corporate whiteboard/display function - sleek aluminum frame
function createWhiteboard(x, y, z, rotationY = 0) {
  const group = new THREE.Group();

  // Aluminum frame - brushed silver
  const frameGeo = new THREE.BoxGeometry(3.2, 2.2, 0.06);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    roughness: 0.4,
    metalness: 0.8
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  group.add(frame);

  // White glossy surface (like a presentation screen)
  const surfaceGeo = new THREE.PlaneGeometry(3.0, 2.0);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0xfafafa,
    roughness: 0.05,
    metalness: 0.0
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.position.z = 0.04;
  group.add(surface);

  // Slim marker/pen tray
  const trayGeo = new THREE.BoxGeometry(1.5, 0.05, 0.08);
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0xa0a0a0,
    roughness: 0.3,
    metalness: 0.7
  });
  const tray = new THREE.Mesh(trayGeo, trayMat);
  tray.position.set(0, -1.05, 0.08);
  group.add(tray);

  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  scene.add(group);
  return group;
}

// Ceiling light function
function createCeilingLight(x, z) {
  const group = new THREE.Group();

  // Light fixture panel
  const fixtureGeo = new THREE.BoxGeometry(2, 0.1, 0.8);
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffee,
    emissiveIntensity: 0.5
  });
  const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
  group.add(fixture);

  // Add actual light
  const light = new THREE.PointLight(0xffffee, 0.3, 15);
  light.position.y = -0.2;
  group.add(light);

  group.position.set(x, 15.9, z);  // Higher ceiling
  scene.add(group);
  return group;
}

// Clock function
function createWallClock(x, y, z, rotationY = 0) {
  const group = new THREE.Group();

  // Clock face
  const faceGeo = new THREE.CircleGeometry(0.4, 32);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.z = 0.02;
  group.add(face);

  // Clock rim
  const rimGeo = new THREE.TorusGeometry(0.4, 0.05, 8, 32);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  group.add(rim);

  // Hour hand
  const hourGeo = new THREE.BoxGeometry(0.04, 0.2, 0.02);
  const handMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const hourHand = new THREE.Mesh(hourGeo, handMat);
  hourHand.position.set(0, 0.1, 0.04);
  hourHand.rotation.z = -Math.PI / 6; // 10 o'clock
  group.add(hourHand);

  // Minute hand
  const minGeo = new THREE.BoxGeometry(0.03, 0.3, 0.02);
  const minHand = new THREE.Mesh(minGeo, handMat);
  minHand.position.set(0, 0.15, 0.04);
  minHand.rotation.z = Math.PI / 3; // 10 minutes
  group.add(minHand);

  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  scene.add(group);
  return group;
}

// Filing cabinet function
function createFilingCabinet(x, z) {
  const group = new THREE.Group();

  // Cabinet body
  const bodyGeo = new THREE.BoxGeometry(0.5, 1.2, 0.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  group.add(body);

  // Drawers (3 drawers)
  for (let i = 0; i < 3; i++) {
    const drawerGeo = new THREE.BoxGeometry(0.45, 0.32, 0.02);
    const drawerMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a });
    const drawer = new THREE.Mesh(drawerGeo, drawerMat);
    drawer.position.set(0, 0.25 + i * 0.38, 0.31);
    group.add(drawer);

    // Drawer handle
    const handleGeo = new THREE.BoxGeometry(0.15, 0.03, 0.03);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, 0.25 + i * 0.38, 0.34);
    group.add(handle);
  }

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

// Add corporate decorations
// Potted plants in corners
createPottedPlant(-18, 18, 1.5);
createPottedPlant(18, 18, 1.5);
createPottedPlant(-18, -8, 1.2);
createPottedPlant(18, -8, 1.2);

// Water cooler
createWaterCooler(-15, 5);

// Whiteboards on walls (moved away from logo area)
// Whiteboards positioned between windows (windows are at z=-8 and z=6)
createWhiteboard(-23.8, 4, -1, Math.PI / 2);   // Left wall - between windows (1.2x)
createWhiteboard(23.8, 4, -1, -Math.PI / 2);   // Right wall - between windows (1.2x)

// Ceiling lights
createCeilingLight(-8, 5);
createCeilingLight(2, 5);
createCeilingLight(12, 5);
createCeilingLight(-8, -5);
createCeilingLight(2, -5);
createCeilingLight(12, -5);

// Wall clocks
createWallClock(-23.8, 5.5, 12, Math.PI / 2);  // Left wall (1.2x)
createWallClock(23.8, 5.5, 12, -Math.PI / 2);  // Right wall (1.2x)

// Filing cabinets
createFilingCabinet(-16, -5);
createFilingCabinet(-16, -7);
createFilingCabinet(16, -5);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ====== ANIMATION LOOP ======
const clock = new THREE.Clock();
let elapsedTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  elapsedTime += delta;

  // Update robot avatars with animations
  for (const avatar of avatars.values()) {
    if (avatar.model.visible) {
      // Find the workstation for this avatar
      const zone = officeZones.get(avatar.zoneName);
      const ws = zone ? zone.workstations[avatar.zoneWorkstationIndex] : null;

      // Update animation mixer
      if (avatar.mixer) {
        avatar.mixer.update(delta);
      }

      // RobotExpressive animations available:
      // Idle, Walking, Running, Dance, Death, Sitting, Standing, Jump, Yes, No, Wave, Punch, ThumbsUp
      // Animation is set within each specific state handler below to avoid conflicts

      // Position avatar and coffee mug based on status
      if (ws) {
        // Determine if agent is actually working (high CPU) or just "active" (low CPU, coffee break)
        // Working = high CPU (>15%) - actively processing
        // Coffee break = active status but low CPU (<15%) - in hysteresis period
        const cpuPercent = avatar.instanceData?.cpuPercent || 0;
        const isActuallyWorking = avatar.status === 'active' && cpuPercent > 15;

        if (avatar.status === 'active' && isActuallyWorking) {
          // === ACTUALLY WORKING: At desk, typing with sophisticated movements ===
          const t = elapsedTime + avatar.typingOffset;
          const fastT = t * 4; // Fast cycle for typing
          const medT = t * 1.5; // Medium cycle for body movement
          const slowT = t * 0.3; // Slow cycle for major movements

          // Initialize activity state if not exists
          if (!avatar.activityState) {
            avatar.activityState = {
              mode: 'typing', // typing, thinking, stretching, reading
              modeStartTime: elapsedTime,
              modeDuration: 5 + Math.random() * 10
            };
          }

          // Switch activity modes periodically
          if (elapsedTime - avatar.activityState.modeStartTime > avatar.activityState.modeDuration) {
            const modes = ['typing', 'typing', 'typing', 'thinking', 'reading'];
            avatar.activityState.mode = modes[Math.floor(Math.random() * modes.length)];
            avatar.activityState.modeStartTime = elapsedTime;
            avatar.activityState.modeDuration = 3 + Math.random() * 8;
          }

          const mode = avatar.activityState.mode;

          // Base position with subtle breathing sway
          const breathSway = Math.sin(medT) * 0.01;
          const typingBob = mode === 'typing' ? Math.sin(fastT * 2) * 0.005 : 0;
          avatar.model.position.set(
            ws.position.x + breathSway,
            typingBob,
            ws.position.z + 0.45
          );

          // Body rotation based on mode
          let bodyLeanX = 0.05; // Default forward lean
          let bodyLeanZ = 0;
          if (mode === 'thinking') {
            bodyLeanX = -0.05 + Math.sin(slowT) * 0.03; // Lean back slightly
            bodyLeanZ = Math.sin(medT) * 0.02;
          } else if (mode === 'reading') {
            bodyLeanX = 0.1 + Math.sin(slowT * 0.5) * 0.02; // More forward lean
          }
          avatar.model.rotation.set(bodyLeanX, Math.PI, bodyLeanZ);

          // Sophisticated head movement
          if (avatar.headGroup) {
            let headX, headY, headZ;

            if (mode === 'typing') {
              // Typing: eyes scanning code, small quick movements
              const scanX = Math.sin(fastT * 0.8) * 0.15; // Scanning left-right
              const scanY = Math.sin(fastT * 1.2) * 0.08; // Small vertical scan
              const typingNod = Math.sin(fastT * 2.5) * 0.02; // Typing rhythm nod
              headX = -0.25 + scanY + typingNod;
              headY = scanX;
              headZ = Math.sin(fastT * 0.5) * 0.02;
            } else if (mode === 'thinking') {
              // Thinking: look up, tilt head, slower movements
              const thinkCycle = Math.sin(slowT * 2);
              headX = -0.1 + thinkCycle * 0.15; // Look up when thinking
              headY = Math.sin(medT) * 0.2; // Look around
              headZ = thinkCycle * 0.08; // Head tilt
            } else if (mode === 'reading') {
              // Reading: focused on screen, small movements
              const readScan = Math.sin(medT * 0.7);
              headX = -0.3 + readScan * 0.05; // Focused down at screen
              headY = readScan * 0.1; // Slow left-right scan
              headZ = 0;
            } else {
              headX = -0.2;
              headY = 0;
              headZ = 0;
            }

            avatar.headGroup.rotation.x = headX;
            avatar.headGroup.rotation.y = headY;
            avatar.headGroup.rotation.z = headZ;
            avatar.headGroup.position.y = 2.0;

            // Open eyelids when awake
            if (avatar.headGroup.userData.leftEyelid) {
              avatar.headGroup.userData.leftEyelid.visible = false;
              avatar.headGroup.userData.rightEyelid.visible = false;
            }
          }

          // Vary animation based on mode and speech bubble visibility
          // Wave = no message bubble (greeting/idle hands)
          // Idle = has message bubble (hands on keyboard, typing)
          if (avatar.actions) {
            const hasActivity = avatar.instanceData?.activity;
            let targetAnim;

            if (hasActivity) {
              // Has speech bubble showing activity - use Idle (hands down, typing posture)
              targetAnim = 'Idle';
            } else {
              // No speech bubble - use Wave (waving/greeting)
              targetAnim = 'Wave';
            }

            if (avatar.currentAction !== targetAnim && avatar.actions[targetAnim]) {
              const prevAction = avatar.actions[avatar.currentAction];
              const nextAction = avatar.actions[targetAnim];
              if (prevAction) prevAction.fadeOut(0.5);
              if (nextAction) {
                nextAction.reset().fadeIn(0.5).play();
                nextAction.timeScale = hasActivity ? 1.2 : 1.0; // Slightly faster when typing
              }
              avatar.currentAction = targetAnim;
            }
          }

          // Hide coffee mug when working
          if (ws.coffeeMug) ws.coffeeMug.visible = false;

          // Flash name card green for active working agents
          if (ws.nameCard && ws.nameCard.card) {
            const flashIntensity = (Math.sin(elapsedTime * 4) + 1) / 2; // 0 to 1 pulse
            ws.nameCard.card.material.emissive.setHex(0x00ff00);
            ws.nameCard.card.material.emissiveIntensity = 0.3 + flashIntensity * 0.7;
          }

        } else if (avatar.status === 'active' && !isActuallyWorking) {
          // === ACTIVE BUT LOW CPU: Coffee break - randomly drink or walk around ===
          const t = elapsedTime + avatar.typingOffset;

          // Initialize coffee break state if not exists
          if (!avatar.coffeeBreakState) {
            avatar.coffeeBreakState = {
              mode: 'drinking', // 'drinking' or 'walking'
              modeStartTime: elapsedTime,
              modeDuration: 8 + Math.random() * 12, // 8-20 seconds per activity
              walkAngle: 0,
              walkRadius: 1.5 + Math.random() * 0.5 // How far they walk from desk
            };
          }

          // Check if it's time to switch activity
          if (elapsedTime - avatar.coffeeBreakState.modeStartTime > avatar.coffeeBreakState.modeDuration) {
            avatar.coffeeBreakState.mode = avatar.coffeeBreakState.mode === 'drinking' ? 'walking' : 'drinking';
            avatar.coffeeBreakState.modeStartTime = elapsedTime;
            avatar.coffeeBreakState.modeDuration = 8 + Math.random() * 12;
          }

          const isCoffeeDrinking = avatar.coffeeBreakState.mode === 'drinking';

          if (isCoffeeDrinking) {
            // === DRINKING COFFEE ===
            const slowT = t * 0.4;

            // Position: sitting at desk but turned slightly, relaxed pose
            avatar.model.position.set(ws.position.x, 0, ws.position.z + 0.5);
            avatar.model.rotation.set(-0.08, Math.PI + 0.2, 0);

            // Drinking cycle
            const drinkPhase = (Math.sin(slowT) + 1) / 2;
            const isSipping = drinkPhase > 0.6;

            // Head movement
            if (avatar.headGroup) {
              if (isSipping) {
                avatar.headGroup.rotation.x = 0.3;
                avatar.headGroup.rotation.y = -0.1;
                avatar.headGroup.rotation.z = 0;
              } else {
                const lookAround = Math.sin(slowT * 0.5) * 0.25;
                avatar.headGroup.rotation.x = -0.15 + Math.sin(slowT * 0.3) * 0.05;
                avatar.headGroup.rotation.y = lookAround;
                avatar.headGroup.rotation.z = Math.sin(slowT * 0.2) * 0.03;
              }
              avatar.headGroup.position.y = 2.0;

              if (avatar.headGroup.userData.leftEyelid) {
                avatar.headGroup.userData.leftEyelid.visible = false;
                avatar.headGroup.userData.rightEyelid.visible = false;
              }
            }

            // Use Idle animation for coffee drinking
            if (avatar.actions && avatar.currentAction !== 'Idle') {
              const prevAction = avatar.actions[avatar.currentAction];
              const nextAction = avatar.actions['Idle'];
              if (prevAction) prevAction.fadeOut(0.5);
              if (nextAction) {
                nextAction.reset().fadeIn(0.5).play();
                nextAction.timeScale = 0.4;
              }
              avatar.currentAction = 'Idle';
            }

            // Show coffee mug with drinking animation
            if (ws.coffeeMug) {
              const scaleBase = 2.0;
              const scaleSip = scaleBase + drinkPhase * 1.0;
              ws.coffeeMug.scale.set(scaleSip, scaleSip, scaleSip);

              const avatarX = ws.position.x;
              const avatarZ = ws.position.z + 0.5;

              const mugRestY = 0.9;
              const mugDrinkY = 1.8;
              const mugY = mugRestY + drinkPhase * (mugDrinkY - mugRestY);

              const mugRestZ = avatarZ - 0.5;
              const mugDrinkZ = avatarZ - 1.2;
              const mugZ = mugRestZ + drinkPhase * (mugDrinkZ - mugRestZ);

              const mugRestX = avatarX + 0.5;
              const mugDrinkX = avatarX + 0.2;
              const mugX = mugRestX + drinkPhase * (mugDrinkX - mugRestX);

              ws.coffeeMug.position.set(mugX, mugY, mugZ);
              ws.coffeeMug.rotation.x = drinkPhase * 0.9;
              ws.coffeeMug.rotation.y = 0.3 - drinkPhase * 0.4;
              ws.coffeeMug.visible = true;
            }

          } else {
            // === WALKING AROUND ===
            const walkSpeed = 0.3;
            avatar.coffeeBreakState.walkAngle += delta * walkSpeed;

            // Walk in a semicircle/arc pattern AWAY from the desk (in front of it)
            // Desk is at ws.position.z, so we walk in the +Z direction (away from desk)
            const centerX = ws.position.x;
            const centerZ = ws.position.z + 2.0; // Center further from desk
            const radiusX = avatar.coffeeBreakState.walkRadius;
            const radiusZ = avatar.coffeeBreakState.walkRadius * 0.5; // Smaller Z radius

            // Use abs(cos) to keep Z always positive (away from desk)
            // This creates a figure-8 like pattern that stays in front of the desk
            const walkX = centerX + Math.sin(avatar.coffeeBreakState.walkAngle) * radiusX;
            const walkZ = centerZ + Math.abs(Math.cos(avatar.coffeeBreakState.walkAngle)) * radiusZ;

            avatar.model.position.set(walkX, 0, walkZ);

            // Face the direction of movement
            // Calculate facing based on actual movement direction
            const prevAngle = avatar.coffeeBreakState.walkAngle - delta * walkSpeed;
            const prevX = centerX + Math.sin(prevAngle) * radiusX;
            const prevZ = centerZ + Math.abs(Math.cos(prevAngle)) * radiusZ;
            const facingAngle = Math.atan2(walkX - prevX, walkZ - prevZ);
            avatar.model.rotation.set(0, facingAngle, 0);

            // Head looking around while walking
            if (avatar.headGroup) {
              const lookT = t * 0.8;
              avatar.headGroup.rotation.x = -0.1 + Math.sin(lookT * 0.5) * 0.1;
              avatar.headGroup.rotation.y = Math.sin(lookT * 0.3) * 0.3;
              avatar.headGroup.rotation.z = 0;
              avatar.headGroup.position.y = 2.0;

              if (avatar.headGroup.userData.leftEyelid) {
                avatar.headGroup.userData.leftEyelid.visible = false;
                avatar.headGroup.userData.rightEyelid.visible = false;
              }
            }

            // Use Walking animation
            if (avatar.actions && avatar.currentAction !== 'Walking') {
              const prevAction = avatar.actions[avatar.currentAction];
              const nextAction = avatar.actions['Walking'];
              if (prevAction) prevAction.fadeOut(0.3);
              if (nextAction) {
                nextAction.reset().fadeIn(0.3).play();
                nextAction.timeScale = 0.6; // Casual walking speed
              }
              avatar.currentAction = 'Walking';
            }

            // Hide coffee mug when walking (left it on desk)
            if (ws.coffeeMug) {
              ws.coffeeMug.position.set(ws.position.x + 0.6, 0.78, ws.position.z + 0.1);
              ws.coffeeMug.scale.set(1, 1, 1);
              ws.coffeeMug.rotation.set(0, 0, 0);
              ws.coffeeMug.visible = true; // Mug stays on desk
            }
          }

          // Reset name card to normal (not flashing) for coffee break
          if (ws.nameCard && ws.nameCard.card) {
            ws.nameCard.card.material.emissive.setHex(0x1a1a2e);
            ws.nameCard.card.material.emissiveIntensity = 0.3;
          }

        } else if (avatar.status === 'idle') {
          // === IDLE: Lying on floor, face up ===
          const restX = ws.position.x + 1.5;
          const restZ = ws.position.z + 1.0;

          // Position lying on floor (face pointing UP at ceiling)
          avatar.model.rotation.order = 'YXZ';
          avatar.model.rotation.set(-Math.PI / 2, 0, 0);
          avatar.model.position.set(restX, 0.3, restZ);

          // Head relaxed - don't override position, let it transform with body
          if (avatar.headGroup) {
            const t = elapsedTime * 0.5 + avatar.typingOffset;
            const breathCycle = Math.sin(t) * 0.5 + 0.5;
            // Keep head at its original local position (set during creation)
            // Only adjust rotation for breathing animation
            avatar.headGroup.rotation.x = breathCycle * 0.05;
            avatar.headGroup.rotation.y = 0;
            avatar.headGroup.rotation.z = breathCycle * 0.03;
            // Don't set position.y here - let it stay at original 2.0 and transform with parent
          }

          // Close eyelids when sleeping
          if (avatar.headGroup && avatar.headGroup.userData && avatar.headGroup.userData.leftEyelid) {
            avatar.headGroup.userData.leftEyelid.visible = true;
            avatar.headGroup.userData.rightEyelid.visible = true;
          }

          // Use slow Idle animation for sleeping
          if (avatar.actions && avatar.currentAction !== 'Idle') {
            const prevAction = avatar.actions[avatar.currentAction];
            const nextAction = avatar.actions['Idle'];
            if (prevAction) prevAction.fadeOut(0.5);
            if (nextAction) {
              nextAction.reset().fadeIn(0.5).play();
              nextAction.timeScale = 0.3; // Slow breathing motion
            }
            avatar.currentAction = 'Idle';
          }

          // Show coffee mug on desk (they left it there)
          if (ws.coffeeMug) {
            ws.coffeeMug.position.set(ws.position.x + 0.6, 0.78, ws.position.z + 0.1);
            ws.coffeeMug.scale.set(1, 1, 1); // Reset scale
            ws.coffeeMug.visible = true;
          }

          // Reset name card to normal (not flashing) for idle
          if (ws.nameCard && ws.nameCard.card) {
            ws.nameCard.card.material.emissive.setHex(0x1a1a2e);
            ws.nameCard.card.material.emissiveIntensity = 0.3;
          }
        }
      }

      // Show/hide Zzz for sleeping agents
      if (avatar.zzzGroup) {
        avatar.zzzGroup.visible = avatar.status === 'idle';
        if (avatar.status === 'idle' && ws) {
          // Position Zzz above beach chair
          const restX = ws.position.x + 1.5;
          const restZ = ws.position.z + 1.0;
          avatar.zzzGroup.position.set(restX + 0.3, 1.8, restZ);
          // Animate Zzz floating up
          const t = elapsedTime * 0.8 + avatar.typingOffset;
          avatar.zzzGroup.position.y = 1.8 + Math.sin(t) * 0.2;
          avatar.zzzGroup.rotation.y = t * 0.5;
        }
      }

      // Update speech bubble with activity
      // Only show bubble for processes with high CPU (actually working)
      // This prevents multiple instances in same project from all showing same activity
      if (avatar.speechBubble) {
        const isActuallyWorking = avatar.status === 'active' &&
                                   avatar.instanceData?.cpuPercent > 10 &&
                                   avatar.instanceData?.activity;
        if (isActuallyWorking) {
          updateSpeechBubble(avatar.speechBubble, avatar.instanceData.activity);
          // Make bubble always face camera
          avatar.speechBubble.group.lookAt(camera.position);
        } else {
          avatar.speechBubble.group.visible = false;
        }
      }
    }
  }

  // Animate coffee mug steam for all workstations in all zones
  for (const zone of officeZones.values()) {
    zone.workstations.forEach(ws => {
      if (ws.coffeeMug && ws.coffeeMug.visible) {
        ws.coffeeMug.children.forEach(child => {
          if (child.userData.steamIndex !== undefined) {
            const t = elapsedTime * 2 + child.userData.steamIndex;
            child.position.y = 0.1 + child.userData.steamIndex * 0.02 + Math.sin(t) * 0.01;
            child.position.x = Math.sin(t * 1.5) * 0.01;
            child.material.opacity = 0.3 + Math.sin(t) * 0.1;
          }
        });
      }
    });

    // Animate code lines flickering
    zone.workstations.forEach(ws => {
      if (ws.codeLines) {
        ws.codeLines.forEach((line, i) => {
          if (line.material.opacity > 0) {
            const flicker = Math.sin(elapsedTime * 10 + i * 2) * 0.1 + 0.9;
            line.material.emissiveIntensity = 0.8 * flicker;
          }
        });
      }
    });
  }

  // Animate conveyor boxes
  boxes.forEach((box) => {
    box.position.x += delta * 0.8;
    if (box.position.x > 7) {
      box.position.x = -7;
    }
  });

  // Update camera from keyboard input
  updateCameraFromKeyboard(delta);

  // Update tap-to-move for mobile
  updateTapToMove(delta);

  // Animate camera focus if transitioning to a project
  if (window.animateCameraFocus) {
    window.animateCameraFocus(delta);
  }

  // Boss Mode auto-tour
  if (window.updateBossMode) {
    window.updateBossMode(delta);
  }

  // Update workstation spotlights for night mode
  if (isNightMode && typeof updateWorkstationLights === 'function') {
    updateWorkstationLights();
  }

  renderer.render(scene, camera);
}

animate();

// ====== TOKEN USAGE DISPLAY ======
function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function fetchUsageStats() {
  try {
    const response = await fetch('/api/factory/usage');
    const data = await response.json();

    const usageContent = document.getElementById('usage-content');
    if (!usageContent) return;

    // Build the mini chart from recent days
    const maxTokens = Math.max(...data.recentDays.map(d => d.tokens), 1);
    const chartBars = data.recentDays.map(d => {
      const height = Math.max(2, (d.tokens / maxTokens) * 28);
      return `<div class="bar" style="height: ${height}px" title="${d.date}: ${formatNumber(d.tokens)} tokens"></div>`;
    }).join('');

    usageContent.innerHTML = `
      <div class="stat">
        <span class="stat-label">Today Messages</span>
        <span class="stat-value">${data.today.messages}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Today Tokens</span>
        <span class="stat-value tokens">${formatNumber(data.today.tokens)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Tool Calls</span>
        <span class="stat-value">${data.today.toolCalls}</span>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div class="stat">
          <span class="stat-label">Total Sessions</span>
          <span class="stat-value">${data.totals.sessions}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total Messages</span>
          <span class="stat-value">${formatNumber(data.totals.messages)}</span>
        </div>
      </div>
      <div class="mini-chart" title="Last 7 days token usage">
        ${chartBars}
      </div>
    `;
  } catch (error) {
    console.error('Error fetching usage stats:', error);
  }
}

// Fetch usage stats on load and every 30 seconds
fetchUsageStats();
setInterval(fetchUsageStats, 30000);

// ====== PROJECT FOCUS CAMERA ======
let cameraAnimating = false;
let cameraTargetPosition = null;
let cameraTargetYaw = null;
let cameraTargetPitch = null;

// Store overview camera position for reset
const overviewCameraPosition = camera.position.clone();
const overviewCameraYaw = cameraYaw;
const overviewCameraPitch = cameraPitch;

// Function to focus camera on a project zone
window.focusOnProject = function(projectName) {
  if (projectName === 'overview') {
    // Reset to overview
    cameraTargetPosition = overviewCameraPosition.clone();
    cameraTargetYaw = overviewCameraYaw;
    cameraTargetPitch = overviewCameraPitch;
    cameraAnimating = true;
    updateProjectButtonActive('overview');
    return;
  }

  if (projectName === 'birdseye') {
    // Bird's eye view - looking straight down from ceiling at office center
    cameraTargetPosition = new THREE.Vector3(5, 30, 5); // High above office center
    cameraTargetYaw = Math.PI; // Facing south (toward front of office)
    cameraTargetPitch = -Math.PI / 2 + 0.05; // Almost straight down (-90 deg)
    cameraAnimating = true;
    updateProjectButtonActive('birdseye');
    return;
  }

  if (projectName === 'outdoor') {
    // Outdoor view - outside the building looking at the facade
    cameraTargetPosition = new THREE.Vector3(0, 8, 45); // Outside, facing the front
    cameraTargetYaw = Math.PI; // Facing toward building
    cameraTargetPitch = -0.1; // Slightly looking up at building
    cameraAnimating = true;
    updateProjectButtonActive('outdoor');
    return;
  }

  const zone = officeZones.get(projectName);
  if (!zone || zone.workstations.length === 0) return;

  // Calculate center of the zone
  const ws = zone.workstations[0];
  const zoneCenter = new THREE.Vector3(
    ws.position.x + 2,
    4,
    ws.position.z + 6
  );

  // Set camera target position (above and in front of zone)
  cameraTargetPosition = zoneCenter;

  // Calculate yaw/pitch to look at the zone
  const lookTarget = new THREE.Vector3(ws.position.x, 1, ws.position.z);
  const toTarget = lookTarget.clone().sub(zoneCenter);
  cameraTargetYaw = Math.atan2(toTarget.x, toTarget.z);
  cameraTargetPitch = Math.atan2(toTarget.y, Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z));

  cameraAnimating = true;
  updateProjectButtonActive(projectName);
};

function updateProjectButtonActive(activeProject) {
  const buttons = document.querySelectorAll('#project-buttons button');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.project === activeProject) {
      btn.classList.add('active');
    }
  });
}

// SVG icons for buttons
const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
  active: '<svg viewBox="0 0 24 24" fill="#22c55e" stroke="none"><circle cx="12" cy="12" r="6"/></svg>',
  idle: '<svg viewBox="0 0 24 24" fill="#eab308" stroke="none"><circle cx="12" cy="12" r="6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
};

// Update project buttons when zones change
function updateProjectButtons() {
  const container = document.getElementById('project-buttons');
  if (!container) return;

  let html = `<button data-project="overview" onclick="window.focusOnProject('overview')">${icons.home} Overview</button>`;
  html += `<button data-project="birdseye" onclick="window.focusOnProject('birdseye')">${icons.target} Bird's Eye</button>`;
  html += `<button data-project="outdoor" onclick="window.focusOnProject('outdoor')">${icons.building} Outdoor</button>`;
  html += `<button data-project="bossmode" onclick="window.toggleBossMode()" id="bossmode-btn">${icons.play} Boss Mode</button>`;

  for (const [projectName, zone] of officeZones) {
    const activeCount = zone.workstations.filter((_, i) => {
      const avatar = Array.from(avatars.values()).find(a => a.zoneName === projectName && a.zoneWorkstationIndex === i);
      return avatar && avatar.status === 'active';
    }).length;
    const statusIcon = activeCount > 0 ? icons.active : icons.idle;
    html += `<button data-project="${projectName}" onclick="window.focusOnProject('${projectName}')">${statusIcon} ${projectName}</button>`;
  }

  container.innerHTML = html;
}

// Call updateProjectButtons periodically
setInterval(updateProjectButtons, 3000);

// Animate camera movement in the render loop (add to animate function)
function animateCameraFocus(delta) {
  if (!cameraAnimating || !cameraTargetPosition) return;

  const lerpFactor = 1 - Math.pow(0.05, delta);

  // Lerp position
  camera.position.lerp(cameraTargetPosition, lerpFactor);

  // Lerp yaw and pitch
  const yawDiff = cameraTargetYaw - cameraYaw;
  const pitchDiff = cameraTargetPitch - cameraPitch;

  cameraYaw += yawDiff * lerpFactor;
  cameraPitch += pitchDiff * lerpFactor;

  // Update camera direction
  updateCameraDirection();

  // Check if we're close enough to stop
  if (camera.position.distanceTo(cameraTargetPosition) < 0.1 &&
      Math.abs(yawDiff) < 0.01 && Math.abs(pitchDiff) < 0.01) {
    cameraAnimating = false;
  }
}

// Export for use in animate loop
window.animateCameraFocus = animateCameraFocus;

// ====== BOSS MODE - AUTO TOUR ======
let bossModeActive = false;
let bossModeProjectIndex = 0;
let bossModeOrbitAngle = 0;
let bossModePhase = 'orbit'; // 'orbit', 'idle_view', or 'transition'
let bossModeTransitionStart = 0;
let bossModeIdleStart = 0;
const BOSS_MODE_ORBIT_SPEED = 0.9; // Radians per second
const BOSS_MODE_IDLE_DURATION = 3000; // 3 seconds for idle agents
const BOSS_MODE_TRANSITION_DURATION = 500; // ms to move between projects

window.toggleBossMode = function() {
  bossModeActive = !bossModeActive;
  const btn = document.getElementById('bossmode-btn');

  if (bossModeActive) {
    if (btn) btn.style.background = '#ef4444';
    if (btn) btn.innerHTML = icons.stop + ' Stop Tour';
    bossModeProjectIndex = 0;
    bossModeOrbitAngle = 0;
    bossModePhase = 'orbit';
    bossModeTransitionStart = Date.now();
    cameraAnimating = false; // Stop any current animation
  } else {
    if (btn) btn.style.background = '';
    if (btn) btn.innerHTML = icons.play + ' Boss Mode';
  }
};

// Lighting mode system: day / night / auto
window.setLightingMode = function(mode) {
  lightingMode = mode;
  applyLightingMode(true); // Force update
  updateLightingButtons();
};

function updateLightingButtons() {
  // Update desktop lighting buttons
  const desktopButtons = document.querySelectorAll('#lighting-toggle .lighting-btn');
  desktopButtons.forEach(btn => {
    if (btn.dataset.mode === lightingMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update mobile lighting buttons
  const mobileButtons = document.querySelectorAll('#mobile-lighting .mobile-light-btn');
  mobileButtons.forEach(btn => {
    if (btn.dataset.mode === lightingMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function applyLightingMode(force = false) {
  // Determine if we should be in night mode
  let shouldBeNight = false;
  if (lightingMode === 'night') {
    shouldBeNight = true;
  } else if (lightingMode === 'day') {
    shouldBeNight = false;
  } else {
    // Auto mode - check local time
    shouldBeNight = isNightTime();
  }

  // Only update if state changed (or forced)
  if (force || shouldBeNight !== isNightMode) {
    isNightMode = shouldBeNight;

    if (isNightMode) {
      // Switch to night - very dark interior
      scene.background.setHex(nightBackground);
      scene.fog.color.setHex(nightFog);
      ambientLight.intensity = 0.05;  // Very dim
      ambientLight.color.setHex(0x222244);
      // Darken walls and floor
      wallMat.color.setHex(nightWallColor);
      floorMat.color.setHex(nightFloorColor);
    } else {
      // Switch to day
      scene.background.setHex(dayBackground);
      scene.fog.color.setHex(dayFog);
      ambientLight.intensity = 0.4;
      ambientLight.color.setHex(0xffffff);
      // Restore wall and floor color
      wallMat.color.setHex(dayWallColor);
      floorMat.color.setHex(dayFloorColor);
    }

    // Update all workstation spotlights
    updateWorkstationLights();
  }
}

// Check auto mode periodically (every minute)
setInterval(() => {
  if (lightingMode === 'auto') {
    applyLightingMode();
  }
}, 60000);

// Apply initial lighting mode on load
setTimeout(() => {
  applyLightingMode();
}, 100);

// Update workstation spotlights based on night mode and agent status
function updateWorkstationLights() {
  for (const [projectName, zone] of officeZones) {
    zone.workstations.forEach((ws, i) => {
      if (ws.spotlight) {
        if (isNightMode) {
          // In night mode, only active agents (working or coffee break) get spotlight
          // Both "actually working" (high CPU) and "coffee break" (low CPU) have status === 'active'
          const avatar = Array.from(avatars.values()).find(
            a => a.zoneName === projectName && a.zoneWorkstationIndex === i
          );
          const shouldLight = avatar && avatar.status === 'active';
          ws.spotlight.intensity = shouldLight ? 2.5 : 0;
          ws.spotlight.visible = shouldLight;
        } else {
          // Day mode - no spotlights needed
          ws.spotlight.intensity = 0;
          ws.spotlight.visible = false;
        }
      }
    });
  }
}

function updateBossMode(delta) {
  if (!bossModeActive) return;

  const projectNames = Array.from(officeZones.keys());
  if (projectNames.length === 0) return;

  const currentProject = projectNames[bossModeProjectIndex % projectNames.length];
  const zone = officeZones.get(currentProject);
  if (!zone) return;

  // Check if any agent in this zone is active
  let hasActiveAgent = false;
  for (const [id, avatar] of avatars) {
    if (avatar.zoneName === currentProject && avatar.status === 'active') {
      hasActiveAgent = true;
      break;
    }
  }

  // Get zone center
  const zoneCenter = new THREE.Vector3(
    zone.workstations[0]?.position.x || 0,
    1.5,
    zone.workstations[0]?.position.z || 0
  );

  const orbitRadius = 6;
  const orbitHeight = 3;

  // Initialize phase on first entry to zone
  if (bossModePhase === 'orbit' && bossModeOrbitAngle === 0) {
    if (!hasActiveAgent) {
      // Switch to idle_view mode for idle agents
      bossModePhase = 'idle_view';
      bossModeIdleStart = Date.now();
    }
  }

  if (bossModePhase === 'idle_view') {
    // For idle agents: ceiling angle looking down
    const camX = zoneCenter.x + 1;  // Slight offset
    const camZ = zoneCenter.z + 1;
    const camY = 12;  // High up, ceiling view

    camera.position.set(camX, camY, camZ);

    // Look down at zone center
    const lookDir = new THREE.Vector3().subVectors(zoneCenter, camera.position).normalize();
    cameraYaw = Math.atan2(lookDir.x, lookDir.z);
    cameraPitch = Math.asin(lookDir.y);  // Will be negative (looking down)
    updateCameraDirection();

    // After 3 seconds, move to next
    if (Date.now() - bossModeIdleStart >= BOSS_MODE_IDLE_DURATION) {
      bossModePhase = 'transition';
      bossModeTransitionStart = Date.now();
    }
  } else if (bossModePhase === 'orbit') {
    // For active agents: full 360 rotation
    bossModeOrbitAngle += BOSS_MODE_ORBIT_SPEED * delta;

    // Calculate camera position on orbit
    const camX = zoneCenter.x + Math.sin(bossModeOrbitAngle) * orbitRadius;
    const camZ = zoneCenter.z + Math.cos(bossModeOrbitAngle) * orbitRadius;
    const camY = orbitHeight;

    camera.position.set(camX, camY, camZ);

    // Look at zone center
    const lookDir = new THREE.Vector3().subVectors(zoneCenter, camera.position).normalize();
    cameraYaw = Math.atan2(lookDir.x, lookDir.z);
    cameraPitch = Math.asin(lookDir.y);
    updateCameraDirection();

    // Check if orbit complete (full 360)
    if (bossModeOrbitAngle >= Math.PI * 2) {
      bossModePhase = 'transition';
      bossModeTransitionStart = Date.now();
      bossModeOrbitAngle = 0;
    }
  } else if (bossModePhase === 'transition') {
    const elapsed = Date.now() - bossModeTransitionStart;
    const progress = Math.min(elapsed / BOSS_MODE_TRANSITION_DURATION, 1);

    if (progress >= 1) {
      // Move to next project
      bossModeProjectIndex = (bossModeProjectIndex + 1) % projectNames.length;
      bossModePhase = 'orbit';  // Will be changed to idle_view if next zone has no active agents
      bossModeOrbitAngle = 0;
      bossModeIdleStart = 0;
    } else {
      // Smooth transition - move camera up briefly
      const nextProject = projectNames[(bossModeProjectIndex + 1) % projectNames.length];
      const nextZone = officeZones.get(nextProject);
      if (nextZone && nextZone.workstations[0]) {
        const nextCenter = new THREE.Vector3(
          nextZone.workstations[0].position.x,
          1.5,
          nextZone.workstations[0].position.z
        );

        // Ease function
        const ease = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Interpolate position with arc
        const arcHeight = 8;
        const arcY = Math.sin(progress * Math.PI) * arcHeight;

        const startPos = new THREE.Vector3(
          zoneCenter.x + Math.sin(0) * orbitRadius,
          orbitHeight,
          zoneCenter.z + Math.cos(0) * orbitRadius
        );
        const endPos = new THREE.Vector3(
          nextCenter.x + Math.sin(0) * orbitRadius,
          orbitHeight,
          nextCenter.z + Math.cos(0) * orbitRadius
        );

        camera.position.lerpVectors(startPos, endPos, ease);
        camera.position.y += arcY;

        // Look toward next zone
        const lookTarget = new THREE.Vector3().lerpVectors(zoneCenter, nextCenter, ease);
        const lookDir = new THREE.Vector3().subVectors(lookTarget, camera.position).normalize();
        cameraYaw = Math.atan2(lookDir.x, lookDir.z);
        cameraPitch = Math.asin(Math.max(-0.5, Math.min(0.5, lookDir.y)));
        updateCameraDirection();
      }
    }
  }
}

// Export for animate loop
window.updateBossMode = updateBossMode;
