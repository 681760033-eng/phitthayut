import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameSettings, Player, Enemy, Collectible, HitBox3D, Particle3D, Fireball, WarpGate } from '../types';
import { playSound } from './AudioEngine';
import { Pause, RotateCcw, Home, Volume2, VolumeX, Shield, Heart, Zap, Award } from 'lucide-react';

interface GameCanvasProps {
  settings: GameSettings;
  onGameOver: (score: number, level: number) => void;
  onGameComplete: (score: number, level: number) => void;
  onQuit: () => void;
}

export default function GameCanvas({ settings, onGameOver, onGameComplete, onQuit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React state for HUD rendering
  const [isPaused, setIsPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(settings.soundEnabled);
  const [hudData, setHudData] = useState({
    hp: 5,
    maxHp: 5,
    score: 0,
    level: 1,
    experience: 0,
    experienceNeeded: 100,
    invulnerable: false,
    skillCooldown: 0, // 0 to 1 percentage
  });

  // Keep logic fast inside a single non-reactive mutable reference block
  const stateRef = useRef({
    player: {
      id: 'player',
      x: 0,
      z: 0,
      y: 0,
      radius: 0.8,
      hp: 5,
      maxHp: 5,
      score: 0,
      level: 1,
      experience: 0,
      experienceNeeded: 100,
      speed: 6.5,
      lastPunchTime: 0,
      lastSkillTime: 0,
      invulnerableUntil: 0,
      currentAction: 'idle' as 'idle' | 'walk' | 'attack' | 'dance',
    } as Player,
    enemies: [] as Enemy[],
    collectibles: [] as Collectible[],
    hitBoxes: [] as HitBox3D[],
    particles: [] as Particle3D[],
    fireballs: [] as Fireball[],
    warpGate: null as WarpGate | null,
    keysHeld: new Set<string>(),
    spawnTimer: 0,
    nextSpawnInterval: 1.5, // Spawn randomly 1 to 3 seconds
    enemiesDefeatedCount: 0,
    bossSpawned: false,
    bossDefeated: false,
    collectibleTimer: 0,
    gameTime: 0,
    difficultyMultiplier: settings.difficulty === 'easy' ? 0.75 : settings.difficulty === 'hard' ? 1.5 : 1.0,
    facingLeft: false,
    
    // Spritesheet parameters
    spriteFrame: 0,
    spriteTimer: 0,
    spriteFPS: 8,
    idleTimer: 0,
  });

  // Keep track of Three.js instances
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerMesh: THREE.Mesh;
    playerTexture: THREE.Texture;
    groundMesh: THREE.Mesh;
    enemiesGroup: THREE.Group;
    fireballsGroup: THREE.Group;
    collectiblesGroup: THREE.Group;
    hitBoxesGroup: THREE.Group;
    particlesGroup: THREE.Group;
    potionTexture: THREE.Texture;
    enemyTexture: THREE.Texture;
    bossTexture: THREE.Texture;
    warpGateMesh: THREE.Mesh | null;
  } | null>(null);

  // Track global keys pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaused((prev) => !prev);
        playSound('click');
        return;
      }
      stateRef.current.keysHeld.add(e.key.toLowerCase());
      
      // Prevent browser scroll scrolling on standard gaming keys
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'p', 'o'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keysHeld.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize ThreeJS Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 1. Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617'); // slate-950 deep space look
    scene.fog = new THREE.FogExp2('#020617', 0.04);

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 7.5, 9);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight('#1e293b', 1.8); // Cool dark blue ambient
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#38bdf8', 2.5); // Radiant light blue accent
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Dynamic glowing fire point light around player
    const playerLight = new THREE.PointLight('#ec4899', 3.0, 10, 1.2);
    playerLight.position.set(0, 1, 0);
    scene.add(playerLight);

    // 5. Load Repeating Ground (Plane of size 50 as requested)
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load(
      'https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/ground_d1kjrx.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(25, 25); // Smaller tiling as requested
        tex.minFilter = THREE.LinearMipmapLinearFilter;
      }
    );

    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2; // Flat on floor XZ plane
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Subtle Grid floor helper layered slightly above ground for retro vibe
    const gridHelper = new THREE.GridHelper(50, 50, '#0e7490', '#083344');
    gridHelper.position.y = 0.01;
    (gridHelper.material as THREE.Material).opacity = 0.25;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // Boundary walls indicators
    const borderGeo = new THREE.BoxGeometry(50, 0.2, 0.2);
    const borderMat = new THREE.MeshBasicMaterial({ color: '#0e7490' });
    
    const wallN = new THREE.Mesh(borderGeo, borderMat); wallN.position.set(0, 0, -25); scene.add(wallN);
    const wallS = new THREE.Mesh(borderGeo, borderMat); wallS.position.set(0, 0, 25); scene.add(wallS);
    
    const wallE = new THREE.Mesh(borderGeo, borderMat); wallE.rotation.y = Math.PI / 2; wallE.position.set(25, 0, 0); scene.add(wallE);
    const wallW = new THREE.Mesh(borderGeo, borderMat); wallW.rotation.y = Math.PI / 2; wallW.position.set(-25, 0, 0); scene.add(wallW);

    // 6. Create Billboard 2D Player Mesh
    const playerTexture = textureLoader.load(
      'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/player.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(0.25, 0.25); // 4 Columns, 4 Rows
        tex.offset.set(0, 0.75); // Start on Row 1 (Idle)
        tex.magFilter = THREE.NearestFilter; // Sharp retro pixels
        tex.minFilter = THREE.NearestFilter;
      }
    );

    const potionTexture = textureLoader.load(
      'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/potion.png',
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
      }
    );

    const enemyTexture = textureLoader.load(
      'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/enemy.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(0.5, 0.5); // 2 columns, 2 rows (4 frames total)
        tex.offset.set(0, 0.5); // Start on Row 1 (Idle)
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
      }
    );

    const bossTexture = textureLoader.load(
      'https://res.cloudinary.com/dsucg33fv/image/upload/v1782709455/boss_e8jti1.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(0.5, 0.5); // 2 columns, 2 rows
        tex.offset.set(0, 0.5);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
      }
    );

    // Create a Plane mesh that billboards to face the camera manually
    const playerGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const playerMat = new THREE.MeshBasicMaterial({
      map: playerTexture,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
    });
    const playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.set(0, 1.1, 0);
    scene.add(playerMesh);

    // Groups for managing dynamic items
    const enemiesGroup = new THREE.Group(); scene.add(enemiesGroup);
    const fireballsGroup = new THREE.Group(); scene.add(fireballsGroup);
    const collectiblesGroup = new THREE.Group(); scene.add(collectiblesGroup);
    const hitBoxesGroup = new THREE.Group(); scene.add(hitBoxesGroup);
    const particlesGroup = new THREE.Group(); scene.add(particlesGroup);

    // Save references to instance object
    threeRef.current = {
      scene,
      camera,
      renderer,
      playerMesh,
      playerTexture,
      groundMesh,
      enemiesGroup,
      fireballsGroup,
      collectiblesGroup,
      hitBoxesGroup,
      particlesGroup,
      potionTexture,
      enemyTexture,
      bossTexture,
      warpGateMesh: null,
    };

    // Responsive Canvas Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const w = width || container.clientWidth;
        const h = height || container.clientHeight;
        
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      playerGeo.dispose();
      playerMat.dispose();
      borderGeo.dispose();
      borderMat.dispose();
    };
  }, []);

  // Main high-performance logic game loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animationFrameId = requestAnimationFrame(loop);

      const dt = Math.min(0.1, (time - lastTime) / 1000); // Caps lag spikes
      lastTime = time;

      if (isPaused) return;

      updateLogic(dt);
      renderThree();
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused]);

  // Game Mechanics update loop
  const updateLogic = (dt: number) => {
    const state = stateRef.current;
    const three = threeRef.current;
    if (!three) return;

    state.gameTime += dt;
    const p = state.player;
    const bindings = settings.bindings;

    // 1. 8-Directional Movement Calculations
    let moveX = 0;
    let moveZ = 0;

    // Support both arrow keys and customizable bindings simultaneously
    if (state.keysHeld.has(bindings.up) || state.keysHeld.has('arrowup')) moveZ -= 1;
    if (state.keysHeld.has(bindings.down) || state.keysHeld.has('arrowdown')) moveZ += 1;
    if (state.keysHeld.has(bindings.left) || state.keysHeld.has('arrowleft')) moveX -= 1;
    if (state.keysHeld.has(bindings.right) || state.keysHeld.has('arrowright')) moveX += 1;

    // Decide current action state
    const isAttackingNow = Date.now() - p.lastPunchTime < 400;

    if (isAttackingNow) {
      p.currentAction = 'attack';
      state.idleTimer = 0;
    } else if (moveX !== 0 || moveZ !== 0) {
      p.currentAction = 'walk';
      state.idleTimer = 0;

      // Calculate normalized 8-directional movement vector
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const speedMultiplier = dt * p.speed;
      
      p.x += (moveX / length) * speedMultiplier;
      p.z += (moveZ / length) * speedMultiplier;

      // Bound inside the Ground size 50 limit (radius boundaries)
      const boundaryLimit = 24.0;
      p.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, p.x));
      p.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, p.z));

      if (moveX < 0) state.facingLeft = true;
      if (moveX > 0) state.facingLeft = false;
    } else {
      // Idle or dancing logic
      state.idleTimer += dt;
      if (state.idleTimer > 3.0) {
        p.currentAction = 'dance'; // Starts dancing if stationary as easter egg/using row 4!
      } else {
        p.currentAction = 'idle';
      }
    }

    // 2. Spritesheet Frame Offsetting Logic
    // Row 1 (Idle): Row Index 3 (Y-offset 0.75)
    // Row 2 (Walk): Row Index 2 (Y-offset 0.50)
    // Row 3 (Attack): Row Index 1 (Y-offset 0.25)
    // Row 4 (Dance): Row Index 0 (Y-offset 0.00)
    let rowIdx = 3;
    let frameFPS = state.spriteFPS;

    if (p.currentAction === 'walk') {
      rowIdx = 2;
    } else if (p.currentAction === 'attack') {
      rowIdx = 1;
      frameFPS = state.spriteFPS * 2.2; // "เล่น Animation ไวขึ้น" - speeds up attack animation
    } else if (p.currentAction === 'dance') {
      rowIdx = 0;
    }

    state.spriteTimer += dt;
    if (state.spriteTimer >= 1 / frameFPS) {
      state.spriteTimer = 0;
      state.spriteFrame = (state.spriteFrame + 1) % 4; // 4 Frames
    }

    // Update ThreeJS texture offsets
    three.playerTexture.offset.set(state.spriteFrame * 0.25, rowIdx * 0.25);

    // Apply facing direction scale flip horizontally
    three.playerMesh.scale.set(state.facingLeft ? -2.2 : 2.2, 2.2, 1);
    three.playerMesh.position.set(p.x, 1.1, p.z);

    // Move PointLight with player
    const lights = three.scene.children.filter((c) => c instanceof THREE.PointLight);
    if (lights.length > 0) {
      lights[0].position.set(p.x, 1.2, p.z);
    }

    // 3. Trigger attack action with key P
    const now = Date.now();
    if (state.keysHeld.has(bindings.punch) && now - p.lastPunchTime > 500) {
      p.lastPunchTime = now;
      playSound('shoot');

      // Spawn a dynamic 3D Hitbox in front of the player
      const punchDirectionX = state.facingLeft ? -1.8 : 1.8;
      const punchZ = p.z;
      const punchX = p.x + punchDirectionX;

      state.hitBoxes.push({
        id: `hitbox-${now}`,
        x: punchX,
        z: punchZ,
        radius: 1.5,
        lifeTime: 0,
        maxLifeTime: 0.25, // Quick punch hitbox
        color: '#f43f5e',
      });

      // Spawn fiery visual particles for punch swing
      for (let i = 0; i < 15; i++) {
        state.particles.push({
          x: punchX + (Math.random() - 0.5) * 0.5,
          y: 0.6 + Math.random() * 0.8,
          z: punchZ + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 8 + (state.facingLeft ? -8 : 8),
          vy: Math.random() * 4,
          vz: (Math.random() - 0.5) * 8,
          color: '#22d3ee',
          alpha: 1.0,
          decay: 2.2,
          size: Math.random() * 0.15 + 0.08,
        });
      }
    }

    // 4. Trigger expanding energy shockwave ring with key O
    const skillCooldownLeft = Math.max(0, 3000 - (now - p.lastSkillTime));
    if (state.keysHeld.has(bindings.skill) && skillCooldownLeft === 0) {
      p.lastSkillTime = now;
      playSound('levelup');

      // Spawn massive expanding shockwave ring hitbox centered on player
      state.hitBoxes.push({
        id: `skill-${now}`,
        x: p.x,
        z: p.z,
        radius: 1.0, // starts small, expands below in the code
        lifeTime: 0,
        maxLifeTime: 0.8, // expands over 0.8 seconds
        color: '#f59e0b',
        isExpandingRing: true,
      });

      // Ring blast burst particles
      for (let i = 0; i < 35; i++) {
        const angle = (i / 35) * Math.PI * 2;
        const blastSpeed = 12;
        state.particles.push({
          x: p.x,
          y: 0.1,
          z: p.z,
          vx: Math.cos(angle) * blastSpeed,
          vy: Math.random() * 2 + 1,
          vz: Math.sin(angle) * blastSpeed,
          color: '#fbbf24',
          alpha: 1.0,
          decay: 1.2,
          size: Math.random() * 0.25 + 0.12,
        });
      }
    }

    // 5. Update HitBoxes & expanding ring size math
    state.hitBoxes.forEach((hb) => {
      hb.lifeTime += dt;
      if (hb.isExpandingRing) {
        // Linearly expand from 1.0 to 7.0 radius as shockwave
        const pct = hb.lifeTime / hb.maxLifeTime;
        hb.radius = 1.0 + pct * 6.5;
        
        // Push particles along edge
        if (Math.random() < 0.4) {
          for (let k = 0; k < 6; k++) {
            const angle = Math.random() * Math.PI * 2;
            state.particles.push({
              x: hb.x + Math.cos(angle) * hb.radius,
              y: 0.1,
              z: hb.z + Math.sin(angle) * hb.radius,
              vx: Math.cos(angle) * 3,
              vy: Math.random() * 1.5,
              vz: Math.sin(angle) * 3,
              color: '#f59e0b',
              alpha: 0.8,
              decay: 1.5,
              size: 0.1,
            });
          }
        }
      }
    });

    // Resolve Collisions: Hitbox vs Enemies
    state.hitBoxes.forEach((hb) => {
      state.enemies.forEach((enemy) => {
        // If the enemy is already dying, ignore further hits
        if (enemy.isDying) return;

        // Basic circle-to-circle 2D collision on ground plane
        const dx = enemy.x - hb.x;
        const dz = enemy.z - hb.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < hb.radius + enemy.radius) {
          // Check hitboxes already hit list to avoid multi-hits from a single attack
          if (!enemy.hitBoxesAlreadyHit) {
            enemy.hitBoxesAlreadyHit = [];
          }
          if (enemy.hitBoxesAlreadyHit.includes(hb.id)) {
            return;
          }
          enemy.hitBoxesAlreadyHit.push(hb.id);

          // Increment hit count
          enemy.hitsReceived = (enemy.hitsReceived ?? 0) + 1;

          // Flash when hit
          enemy.hitFlashTime = 0.35;

          // SPECIAL BOSS DAMAGE PATH
          if (enemy.type === 'boss') {
            const currentHits = enemy.hitsReceived;
            if (currentHits < 6) {
              // Boss takes hits: small knockback & flash red
              playSound('hit');

              const pushDirX = dx === 0 ? (Math.random() - 0.5) : dx;
              const pushDirZ = dz === 0 ? (Math.random() - 0.5) : dz;
              const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirZ * pushDirZ) || 1;

              const pushForce = hb.isExpandingRing ? 5.0 : 3.0;
              enemy.x += (pushDirX / pushLen) * pushForce;
              enemy.z += (pushDirZ / pushLen) * pushForce;

              // Sparkles on hit
              for (let i = 0; i < 10; i++) {
                state.particles.push({
                  x: enemy.x + (Math.random() - 0.5) * 1.5,
                  y: 1.0 + Math.random() * 1.5,
                  z: enemy.z + (Math.random() - 0.5) * 1.5,
                  vx: (Math.random() - 0.5) * 8,
                  vy: Math.random() * 5 + 2,
                  vz: (Math.random() - 0.5) * 8,
                  color: '#ef4444', // dramatic crimson blood/fire sparks
                  alpha: 1.0,
                  decay: 2.2,
                  size: 0.1,
                });
              }
            } else {
              // Final 6th hit: BOSS IS DEFEATED!
              enemy.isDying = true;
              enemy.dyingTimer = 2.5; // long dramatic dying trajectory
              enemy.y = 1.5;

              const pushDirX = dx === 0 ? (Math.random() - 0.5) : dx;
              const pushDirZ = dz === 0 ? (Math.random() - 0.5) : dz;
              const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirZ * pushDirZ) || 1;

              enemy.deathVx = (pushDirX / pushLen) * 10.0;
              enemy.deathVy = 20.0; // Launches super high!
              enemy.deathVz = (pushDirZ / pushLen) * 10.0;

              playSound('hit');
              playSound('levelup'); // Epic sound triggers!
              state.bossDefeated = true;

              // Huge score / XP award
              p.score += enemy.scoreValue;
              gainXP(1000); // Massive XP boost

              // Giant gold/firework explosion particles!
              for (let i = 0; i < 60; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 18 + 5;
                state.particles.push({
                  x: enemy.x,
                  y: 1.5,
                  z: enemy.z,
                  vx: Math.cos(angle) * speed,
                  vy: Math.random() * 16 + 5,
                  vz: Math.sin(angle) * speed,
                  color: '#eab308', // pure gold victory sparks
                  alpha: 1.0,
                  decay: 1.5,
                  size: 0.16,
                });
              }
            }
            return; // Skip normal enemy hit calculations
          }

          // STANDARD CRAWLER/CHASER/SHOOTER DAMAGE PATH
          if (enemy.hitsReceived === 1) {
            // First Hit: knockback backwards!
            // "ครั้งแรกให้กระเด็นไปข้างหลังทิศทางที่เดินมา" (knockback backwards in direction they walked/came from)
            playSound('hit');
            
            // Calculate push back direction (away from player/hitbox)
            const pushDirX = dx === 0 ? (Math.random() - 0.5) : dx;
            const pushDirZ = dz === 0 ? (Math.random() - 0.5) : dz;
            const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirZ * pushDirZ) || 1;
            
            const pushForce = hb.isExpandingRing ? 12.0 : 8.0;
            enemy.x += (pushDirX / pushLen) * pushForce;
            enemy.z += (pushDirZ / pushLen) * pushForce;

            // Spawn hurt sparks
            for (let i = 0; i < 8; i++) {
              state.particles.push({
                x: enemy.x,
                y: 0.8 + Math.random() * 0.6,
                z: enemy.z,
                vx: (Math.random() - 0.5) * 10,
                vy: Math.random() * 6,
                vz: (Math.random() - 0.5) * 10,
                color: '#ffffff', // white flash sparks
                alpha: 1.0,
                decay: 2.5,
                size: 0.08,
              });
            }
          } else {
            // Second Hit: "ครั้งสองให้กระเด็นออกจากฉากไป หรือ กระพริบสีขาวรัวๆ แล้วหายไป"
            // Let's mark as dying, launch high in the air, and let them fade out flashing white!
            enemy.isDying = true;
            enemy.dyingTimer = 1.2; // 1.2 seconds of animation
            enemy.y = 0.8; // start above ground slightly
            
            // Launch vector: away from player and high up
            const pushDirX = dx === 0 ? (Math.random() - 0.5) : dx;
            const pushDirZ = dz === 0 ? (Math.random() - 0.5) : dz;
            const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirZ * pushDirZ) || 1;
            
            const horizSpeed = hb.isExpandingRing ? 18.0 : 14.0;
            enemy.deathVx = (pushDirX / pushLen) * horizSpeed;
            enemy.deathVy = 16.0; // Upwards jump!
            enemy.deathVz = (pushDirZ / pushLen) * horizSpeed;

            playSound('hit');
            playSound('levelup'); // Critical sound effect
            
            // Increment the regular defeated enemies counter
            state.enemiesDefeatedCount += 1;

            // Score and XP reward on second hit defeat!
            p.score += enemy.scoreValue;
            gainXP(enemy.scoreValue * 0.4);

            // Large flashy death blast sparks
            for (let i = 0; i < 20; i++) {
              state.particles.push({
                x: enemy.x,
                y: 0.5 + Math.random() * 0.8,
                z: enemy.z,
                vx: (Math.random() - 0.5) * 15,
                vy: Math.random() * 12,
                vz: (Math.random() - 0.5) * 15,
                color: enemy.color,
                alpha: 1.0,
                decay: 1.8,
                size: 0.15,
              });
            }
          }
        }
      });
    });

    // Remove expired hitboxes
    state.hitBoxes = state.hitBoxes.filter((hb) => hb.lifeTime < hb.maxLifeTime);

    // 6. Spawning Monsters Logic
    state.spawnTimer += dt;
    if (state.spawnTimer >= state.nextSpawnInterval) {
      state.spawnTimer = 0;
      // "ระบบสุ่ม enemy ออกมาจากทุกทิศทางทุกๆ 1-3 วินาที" (Random spawn interval 1-3 seconds)
      state.nextSpawnInterval = 1.0 + Math.random() * 2.0;

      // Only spawn regular enemies if Boss is NOT alive and NOT defeated yet
      if (!state.bossSpawned) {
        spawnEnemy();
      }
    }

    // Trigger Boss spawn if 10+ enemies defeated
    if (state.enemiesDefeatedCount >= 10 && !state.bossSpawned) {
      state.bossSpawned = true;
      state.enemies.push({
        id: 'boss',
        x: 0,
        y: 1.5, // "บินไปมา" (Boss flies / floats)
        z: -12,
        radius: 1.5,
        hp: 6, // 6 hits to defeat
        maxHp: 6,
        type: 'boss',
        scoreValue: 2500,
        color: '#ef4444',
        speed: 3.5,
        bossState: 'IDLE',
        bossStateTimer: 2.5,
        bossScaleX: 1.0,
        bossScaleY: 1.0,
        fireballTimer: 0,
        facingLeft: false,
        hitsReceived: 0,
      });
      playSound('levelup'); // Epic warning alert sound
    }

    // 7. Update Enemies
    state.enemies.forEach((enemy) => {
      // Ensure height starts at 0 if not defined
      if (enemy.y === undefined) {
        enemy.y = 0;
      }

      // Decrement hit flash timers
      if (enemy.hitFlashTime !== undefined && enemy.hitFlashTime > 0) {
        enemy.hitFlashTime -= dt;
      }

      if (enemy.isDying) {
        // Apply flying out of bounds and gravity physics
        enemy.x += (enemy.deathVx ?? 0) * dt;
        enemy.y = (enemy.y ?? 0) + (enemy.deathVy ?? 0) * dt;
        enemy.z += (enemy.deathVz ?? 0) * dt;

        // Apply downward gravity
        enemy.deathVy = (enemy.deathVy ?? 16.0) - 32.0 * dt;

        // Count down the dying timer
        if (enemy.dyingTimer !== undefined) {
          enemy.dyingTimer -= dt;
          if (enemy.dyingTimer <= 0) {
            enemy.hp = 0; // Filter out from active array
          }
        }
        return; // Skip seeking player & dealing contact damage
      }

      // Boss Specific AI
      if (enemy.type === 'boss') {
        if (!enemy.bossState) {
          enemy.bossState = 'IDLE';
          enemy.bossStateTimer = 2.0;
          enemy.bossScaleX = 1.0;
          enemy.bossScaleY = 1.0;
          enemy.fireballTimer = 0.0;
        }

        // Floating flying effect: smooth vertical sine wave
        enemy.y = 1.6 + Math.sin(state.gameTime * 4.0) * 0.4;

        if (enemy.bossStateTimer !== undefined) {
          enemy.bossStateTimer -= dt;
        }

        if (enemy.bossState === 'IDLE') {
          enemy.bossScaleX = 1.0;
          enemy.bossScaleY = 1.0;

          if (enemy.bossStateTimer !== undefined && enemy.bossStateTimer <= 0) {
            // 50% chance to Dash (พุ่งไกล-ใกล้) or Prepare Attack
            if (Math.random() < 0.5) {
              enemy.bossState = 'DASH';
              enemy.bossStateTimer = 1.2; // dash duration
              const angle = Math.random() * Math.PI * 2;
              const range = 6 + Math.random() * 12; // Far-near spots relative to player
              enemy.bossTargetX = Math.max(-23, Math.min(23, p.x + Math.cos(angle) * range));
              enemy.bossTargetZ = Math.max(-23, Math.min(23, p.z + Math.sin(angle) * range));
            } else {
              enemy.bossState = 'PREPARE';
              enemy.bossStateTimer = 1.6; // duration of squash stretch warning
              playSound('shoot'); // Charge-up warning sound!
            }
          }
        } else if (enemy.bossState === 'DASH') {
          const tx = enemy.bossTargetX ?? 0;
          const tz = enemy.bossTargetZ ?? 0;
          const dx = tx - enemy.x;
          const dz = tz - enemy.z;
          const dLen = Math.sqrt(dx * dx + dz * dz);

          if (dLen > 0.5) {
            const dashSpeed = 9.5;
            enemy.x += (dx / dLen) * dashSpeed * dt;
            enemy.z += (dz / dLen) * dashSpeed * dt;
            enemy.facingLeft = dx < 0;
          }

          if ((enemy.bossStateTimer !== undefined && enemy.bossStateTimer <= 0) || dLen <= 0.5) {
            enemy.bossState = 'IDLE';
            enemy.bossStateTimer = 0.8; // pause shortly
          }
        } else if (enemy.bossState === 'PREPARE') {
          // "ก่อนโยนลูกไฟจะขยายย่อ เป็น step บอก" (squash and stretch step scaling warning)
          const osc = 1.0 + Math.sin(state.gameTime * 24.0) * 0.25;
          enemy.bossScaleX = osc;
          enemy.bossScaleY = 2.0 - osc;

          if (enemy.bossStateTimer !== undefined && enemy.bossStateTimer <= 0) {
            enemy.bossState = 'ATTACK';
            enemy.bossStateTimer = 0.6; // recovery state duration
            
            // "ยิงลูกไฟกลม ขึ้นฟ้า สุ่มตกลงมาใส่ Player จังหวะพอให้หลบได้"
            // Spawn 3 fireballs (1 direct, 2 scattered near player)
            for (let i = 0; i < 3; i++) {
              const scatterAngle = Math.random() * Math.PI * 2;
              const scatterDist = i === 0 ? 0 : 2 + Math.random() * 5.0;
              const targetX = Math.max(-23, Math.min(23, p.x + Math.cos(scatterAngle) * scatterDist));
              const targetZ = Math.max(-23, Math.min(23, p.z + Math.sin(scatterAngle) * scatterDist));

              state.fireballs.push({
                id: `fireball-${Date.now()}-${Math.random()}`,
                x: enemy.x,
                y: enemy.y,
                z: enemy.z,
                radius: 1.2, // explosion impact damage radius
                targetX,
                targetZ,
                maxHeight: 11 + Math.random() * 4,
                lifeTime: 0,
                maxLifeTime: 1.8, // 1.8s duration is perfectly dodgeable
                speedX: enemy.x, // store startX
                speedZ: enemy.z, // store startZ
              });
            }
            playSound('shoot');
          }
        } else if (enemy.bossState === 'ATTACK') {
          enemy.bossScaleX = 1.0;
          enemy.bossScaleY = 1.0;

          if (enemy.bossStateTimer !== undefined && enemy.bossStateTimer <= 0) {
            enemy.bossState = 'IDLE';
            enemy.bossStateTimer = 1.2;
          }
        }

        // Deal contact damage to player from Boss
        const dx = p.x - enemy.x;
        const dz = p.z - enemy.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < enemy.radius + p.radius) {
          damagePlayer(1);
          enemy.hitFlashTime = 0.15;
        }

        return; // Skip standard seeker AI
      }

      // Seek the player (standard regular enemies)
      const dx = p.x - enemy.x;
      const dz = p.z - enemy.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.z += (dz / dist) * enemy.speed * dt;

        // Flip left or right depending on movement
        enemy.facingLeft = dx < 0;
      }

      // "เวลาโจมตีให้กระพริบสีแดง" (Flash red when in attacking proximity < 2.0 or when hitting)
      if (dist < 2.0) {
        if (Math.floor(state.gameTime * 12) % 2 === 0) {
          enemy.hitFlashTime = 0.08;
        }
      }

      // Deal continuous contact damage to player
      if (dist < enemy.radius + p.radius) {
        damagePlayer(1);
        enemy.hitFlashTime = 0.15;
      }
    });

    // Filter dead/out-of-bounds enemies or completed dying animation
    state.enemies = state.enemies.filter((e) => {
      if (e.isDying) {
        return (e.dyingTimer ?? 0) > 0;
      }
      return e.hp > 0;
    });

    // Update Fireballs physics and explosions
    state.fireballs.forEach((fb) => {
      fb.lifeTime += dt;
      const progress = Math.min(1.0, fb.lifeTime / fb.maxLifeTime);

      const sX = fb.speedX ?? fb.x;
      const sZ = fb.speedZ ?? fb.z;
      fb.x = sX + (fb.targetX - sX) * progress;
      fb.z = sZ + (fb.targetZ - sZ) * progress;

      // Parabolic flight trajectory height
      fb.y = Math.sin(progress * Math.PI) * fb.maxHeight;

      if (progress >= 1.0) {
        fb.y = 0;
        // Explode on the ground!
        const distToPlayer = Math.sqrt((p.x - fb.targetX) ** 2 + (p.z - fb.targetZ) ** 2);
        if (distToPlayer < fb.radius + p.radius && !fb.damageDealt) {
          damagePlayer(1);
          fb.damageDealt = true;
        }

        playSound('hit'); // explosion sound

        // Sparkle explosion particles
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 2;
          state.particles.push({
            x: fb.targetX,
            y: 0.1 + Math.random() * 0.5,
            z: fb.targetZ,
            vx: Math.cos(angle) * speed,
            vy: Math.random() * 5 + 2,
            vz: Math.sin(angle) * speed,
            color: '#f97316', // bright orange flame
            alpha: 1.0,
            decay: 2.0,
            size: 0.12,
          });
        }
      }
    });

    // Clean up exploded fireballs
    state.fireballs = state.fireballs.filter((fb) => fb.lifeTime < fb.maxLifeTime);

    // Warp Gate Portal logic
    if (state.bossDefeated && !state.warpGate) {
      state.warpGate = {
        id: 'warpgate',
        x: 0,
        y: 0,
        z: 0,
        radius: 1.8,
        active: true,
        pulseTime: 0,
      };
      playSound('levelup');
    }

    if (state.warpGate) {
      state.warpGate.pulseTime += dt;
      const dist = Math.sqrt((p.x - state.warpGate.x) ** 2 + (p.z - state.warpGate.z) ** 2);
      if (dist < state.warpGate.radius + p.radius) {
        // PLAYER TOUCHED THE WARP GATE PORTAL: TRIGGER THE AMAZING RPG ENDING!
        onGameComplete(p.score, p.level);
      }
    }

    // 8. Collectibles logic
    state.collectibleTimer += dt;
    if (state.collectibleTimer >= 3.8) {
      state.collectibleTimer = 0;
      spawnCollectible();
    }

    state.collectibles.forEach((col) => {
      // If falling down from the sky, apply gravity
      if (col.y > 0) {
        col.y = Math.max(0, col.y - 14 * dt); // Fall at a rate of 14 units/second
        
        // Spawn soft impact dust rings when hitting the ground
        if (col.y === 0) {
          for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            state.particles.push({
              x: col.x,
              y: 0.1,
              z: col.z,
              vx: Math.cos(angle) * speed,
              vy: Math.random() * 2 + 1,
              vz: Math.sin(angle) * speed,
              color: col.color,
              alpha: 0.8,
              decay: 2.0,
              size: 0.08,
            });
          }
        }
      }

      col.pulseTime += dt;
      // Magnet pull toward player if close
      const dx = p.x - col.x;
      const dz = p.z - col.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 4.5) {
        col.x += (dx / dist) * 5 * dt;
        col.z += (dz / dist) * 5 * dt;
      }

      // Collect item contact
      if (dist < p.radius + col.radius) {
        col.x = -9999; // mark to remove
        
        if (col.type === 'coin') {
          playSound('coin');
          p.score += col.value;
          gainXP(20);
        } else if (col.type === 'gem') {
          playSound('coin');
          p.score += col.value;
          gainXP(50);
        } else if (col.type === 'heart' || col.type === 'potion') {
          playSound('shield');
          p.hp = Math.min(p.maxHp, p.hp + 1); // Restore 1 HP out of 5 maximum
        } else if (col.type === 'shield') {
          playSound('shield');
          p.invulnerableUntil = Date.now() + 4000; // 4 seconds invincible
        }

        // Collect flash rings
        for (let i = 0; i < 15; i++) {
          const angle = (i / 15) * Math.PI * 2;
          state.particles.push({
            x: p.x,
            y: 0.5,
            z: p.z,
            vx: Math.cos(angle) * 6,
            vy: Math.random() * 3 + 2,
            vz: Math.sin(angle) * 6,
            color: col.color,
            alpha: 1.0,
            decay: 2.0,
            size: 0.1,
          });
        }
      }
    });

    state.collectibles = state.collectibles.filter((c) => c.x !== -9999);

    // 9. Update custom retro particles
    state.particles.forEach((pt) => {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.alpha -= pt.decay * dt;
    });
    state.particles = state.particles.filter((pt) => pt.alpha > 0);

    // Camera follow player (fluid high angle third person look)
    three.camera.position.set(p.x, p.y + 6.8, p.z + 8.2);
    three.camera.lookAt(p.x, p.y + 0.6, p.z);

    // 10. Update React state HUD variables
    const skillCooldownLeftPct = Math.min(1.0, (now - p.lastSkillTime) / 3000);
    setHudData({
      hp: p.hp,
      maxHp: p.maxHp,
      score: p.score,
      level: p.level,
      experience: p.experience,
      experienceNeeded: p.experienceNeeded,
      invulnerable: p.invulnerableUntil > Date.now(),
      skillCooldown: skillCooldownLeftPct,
    });
  };

  // ThreeJS 3D Render synchronization
  const renderThree = () => {
    const three = threeRef.current;
    const state = stateRef.current;
    if (!three) return;

    // 1. Render all active Enemies inside group
    // Clear old enemy meshes quickly
    while (three.enemiesGroup.children.length > 0) {
      const child = three.enemiesGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
      three.enemiesGroup.remove(child);
    }

    state.enemies.forEach((enemy) => {
      let geo: THREE.PlaneGeometry;
      let tex: THREE.Texture;

      if (enemy.type === 'boss') {
        // Boss size is larger and scales on prepare/attack states
        const scaleX = 3.2 * (enemy.bossScaleX ?? 1.0);
        const scaleY = 3.2 * (enemy.bossScaleY ?? 1.0);
        geo = new THREE.PlaneGeometry(scaleX, scaleY);
        tex = three.bossTexture.clone();
        tex.needsUpdate = true;

        // "มี 256x256px จำนวน 4 frame 2 แถว" (Row 1 stands/flies, Row 2 action/screams)
        const isPreparing = enemy.bossState === 'PREPARE' || enemy.bossState === 'ATTACK';
        const animFrame = Math.floor(state.gameTime * 4) % 2; // 2 frames per row
        const uOffset = animFrame * 0.5;
        const vOffset = isPreparing ? 0.0 : 0.5; // Action is bottom row (0.0), idle/flying is top row (0.5)

        if (enemy.facingLeft) {
          tex.repeat.set(-0.5, 0.5);
          tex.offset.set(uOffset + 0.5, vOffset);
        } else {
          tex.repeat.set(0.5, 0.5);
          tex.offset.set(uOffset, vOffset);
        }
      } else {
        // Standard regular enemy PlaneGeometry and texture
        geo = new THREE.PlaneGeometry(1.8, 1.8);
        tex = three.enemyTexture.clone();
        tex.needsUpdate = true;

        const isWalking = !enemy.isDying && enemy.speed > 0;
        const animFrame = Math.floor(state.gameTime * 6) % 2; // 2 frames per row
        const uOffset = animFrame * 0.5;
        const vOffset = isWalking ? 0.0 : 0.5; // Walking is bottom row (0.0), Standing is top row (0.5)

        if (enemy.facingLeft) {
          tex.repeat.set(-0.5, 0.5);
          tex.offset.set(uOffset + 0.5, vOffset);
        } else {
          tex.repeat.set(0.5, 0.5);
          tex.offset.set(uOffset, vOffset);
        }
      }

      // Create basic material with transparent alpha testing
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
      });

      // Handle color flashing / blinking effects
      if (enemy.isDying) {
        // "กระพริบสีขาวรัวๆ แล้วหายไป" (rapid white flashing & fade opacity)
        const flashRate = 18; // Fast blinking
        const isFlashOn = Math.floor(state.gameTime * flashRate) % 2 === 0;
        mat.opacity = isFlashOn ? 0.95 : 0.25;
        mat.color.set('#ffffff'); // Flash white
      } else if (enemy.hitFlashTime !== undefined && enemy.hitFlashTime > 0) {
        // "เวลาโจมตีให้กระพริบสีแดง" (Red color tint on hit or attack contact)
        mat.color.set('#ff2222');
      } else {
        mat.color.set('#ffffff'); // Default sprite colors
      }

      const mesh = new THREE.Mesh(geo, mat);
      
      // Calculate display height
      // Boss floats naturally, while regular enemies walk on ground
      const displayY = enemy.type === 'boss' 
        ? (enemy.isDying ? enemy.y : (enemy.y ?? 1.5)) 
        : (enemy.isDying ? 0.9 + (enemy.y ?? 0) : 0.9);
      mesh.position.set(enemy.x, displayY, enemy.z);
      
      three.enemiesGroup.add(mesh);
    });

    // Render Fireballs
    while (three.fireballsGroup.children.length > 0) {
      const child = three.fireballsGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
      three.fireballsGroup.remove(child);
    }

    state.fireballs.forEach((fb) => {
      // 1. Draw Target Warning Decal Ring on ground
      const progress = fb.lifeTime / fb.maxLifeTime;
      const ringRadius = fb.radius * (1.5 - progress * 1.0);
      const ringGeo = new THREE.RingGeometry(ringRadius * 0.85, ringRadius, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#f97316',
        transparent: true,
        opacity: 0.6 + Math.sin(state.gameTime * 20.0) * 0.2, // fast orange strobe
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(fb.targetX, 0.06, fb.targetZ);
      three.fireballsGroup.add(ringMesh);

      // Draw solid target fill disc in the center
      const discGeo = new THREE.CircleGeometry(fb.radius * progress, 24);
      const discMat = new THREE.MeshBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = -Math.PI / 2;
      discMesh.position.set(fb.targetX, 0.05, fb.targetZ);
      three.fireballsGroup.add(discMesh);

      // 2. Draw actual Fireball projectile
      const sphereGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: '#f97316',
        transparent: true,
        opacity: 0.9,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.set(fb.x, fb.y, fb.z);
      sphereMesh.rotation.set(state.gameTime * 5.0, state.gameTime * 3.0, 0);
      three.fireballsGroup.add(sphereMesh);

      // Spawn trial flame particles
      if (Math.random() < 0.4) {
        state.particles.push({
          x: fb.x + (Math.random() - 0.5) * 0.3,
          y: fb.y + (Math.random() - 0.5) * 0.3,
          z: fb.z + (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2,
          vz: (Math.random() - 0.5) * 2,
          color: '#fb923c',
          alpha: 0.8,
          decay: 2.0,
          size: 0.1,
        });
      }
    });

    // Render Warp Gate portal rings and rise streams if active
    if (state.warpGate) {
      if (!three.warpGateMesh) {
        const portalGeo = new THREE.RingGeometry(1.4, 1.8, 32);
        const portalMat = new THREE.MeshBasicMaterial({
          color: '#10b981', // emerald green warp gate portal
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(portalGeo, portalMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(state.warpGate.x, 0.05, state.warpGate.z);
        three.scene.add(mesh);
        three.warpGateMesh = mesh;
      } else {
        three.warpGateMesh.rotation.z = state.gameTime * 1.5;
        const pulse = 1.0 + Math.sin(state.gameTime * 6.0) * 0.15;
        three.warpGateMesh.scale.set(pulse, pulse, 1.0);

        // Rising streams vertical energy particles
        if (Math.random() < 0.4) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 1.6;
          state.particles.push({
            x: state.warpGate.x + Math.cos(angle) * dist,
            y: 0.05,
            z: state.warpGate.z + Math.sin(angle) * dist,
            vx: 0,
            vy: Math.random() * 3.5 + 1.5, // float upwards!
            vz: 0,
            color: '#10b981',
            alpha: 0.9,
            decay: 1.2,
            size: 0.08,
          });
        }
      }
    } else {
      if (three.warpGateMesh) {
        three.scene.remove(three.warpGateMesh);
        three.warpGateMesh.geometry.dispose();
        if (Array.isArray(three.warpGateMesh.material)) {
          three.warpGateMesh.material.forEach((m) => m.dispose());
        } else {
          three.warpGateMesh.material.dispose();
        }
        three.warpGateMesh = null;
      }
    }

    // 2. Render Collectibles
    while (three.collectiblesGroup.children.length > 0) {
      const child = three.collectiblesGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      three.collectiblesGroup.remove(child);
    }

    state.collectibles.forEach((col) => {
      let mesh: THREE.Mesh;

      if (col.type === 'potion' || col.type === 'heart') {
        const geo = new THREE.PlaneGeometry(1.2, 1.2);
        const mat = new THREE.MeshBasicMaterial({
          map: three.potionTexture,
          transparent: true,
          alphaTest: 0.3,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geo, mat);

        // If falling down, use col.y, otherwise hover around on ground
        const displayY = col.y > 0 ? col.y : 0.6 + Math.sin(col.pulseTime * 4.0) * 0.12;
        mesh.position.set(col.x, displayY, col.z);
      } else {
        let geo: THREE.BufferGeometry;
        if (col.type === 'shield') {
          geo = new THREE.ConeGeometry(0.35, 0.7, 4);
        } else {
          geo = new THREE.SphereGeometry(0.3, 8, 8);
        }

        const mat = new THREE.MeshStandardMaterial({
          color: col.color,
          emissive: col.color,
          emissiveIntensity: 0.9,
          roughness: 0.1,
        });

        mesh = new THREE.Mesh(geo, mat);
        // If falling down, use col.y, otherwise hover around on ground
        const displayY = col.y > 0 ? col.y : 0.5 + Math.sin(col.pulseTime * 4.0) * 0.18;
        mesh.position.set(col.x, displayY, col.z);
        mesh.rotation.y = state.gameTime * 3.0;
      }

      three.collectiblesGroup.add(mesh);
    });

    // 3. Render visual Punch hitboxes or expanding shockwave skill rings
    while (three.hitBoxesGroup.children.length > 0) {
      const child = three.hitBoxesGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      three.hitBoxesGroup.remove(child);
    }

    state.hitBoxes.forEach((hb) => {
      if (hb.isExpandingRing) {
        // Glowing shockwave ring lying flat on the floor plane
        const geo = new THREE.RingGeometry(hb.radius * 0.9, hb.radius, 32);
        const mat = new THREE.MeshBasicMaterial({
          color: hb.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 1.0 - (hb.lifeTime / hb.maxLifeTime),
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(hb.x, 0.05, hb.z);
        three.hitBoxesGroup.add(mesh);
      } else {
        // Normal quick red slash mesh for punches
        const geo = new THREE.BoxGeometry(hb.radius * 2, 0.2, hb.radius * 2);
        const mat = new THREE.MeshBasicMaterial({
          color: hb.color,
          transparent: true,
          opacity: 0.5,
          wireframe: true,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(hb.x, 0.6, hb.z);
        three.hitBoxesGroup.add(mesh);
      }
    });

    // 4. Render particles efficiently as standard tiny colored boxes
    while (three.particlesGroup.children.length > 0) {
      const child = three.particlesGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      three.particlesGroup.remove(child);
    }

    // Limit particles counts to prevent WebGL context lag issues
    const renderCount = Math.min(150, state.particles.length);
    for (let i = 0; i < renderCount; i++) {
      const pt = state.particles[i];
      const geo = new THREE.BoxGeometry(pt.size, pt.size, pt.size);
      const mat = new THREE.MeshBasicMaterial({
        color: pt.color,
        transparent: true,
        opacity: pt.alpha,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pt.x, pt.y, pt.z);
      three.particlesGroup.add(mesh);
    }

    // Flickering player if invulnerable
    const isCurrentlyInvuln = state.player.invulnerableUntil > Date.now();
    if (isCurrentlyInvuln && Math.floor(Date.now() / 80) % 2 === 0) {
      (three.playerMesh.material as THREE.Material).opacity = 0.35;
    } else {
      (three.playerMesh.material as THREE.Material).opacity = 1.0;
    }

    // Call actual Three.js drawing
    three.renderer.render(three.scene, three.camera);
  };

  // Helpers
  const damagePlayer = (amount: number) => {
    const state = stateRef.current;
    const p = state.player;
    const now = Date.now();

    if (p.invulnerableUntil > now) return; // currently invulnerable

    p.hp -= amount;
    p.invulnerableUntil = now + 1200; // 1.2s invulnerability frame
    playSound('hit');

    // Spawn massive burst of damage particles
    for (let i = 0; i < 20; i++) {
      state.particles.push({
        x: p.x,
        y: 1.0,
        z: p.z,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * 8,
        vz: (Math.random() - 0.5) * 12,
        color: '#ef4444',
        alpha: 1.0,
        decay: 2.5,
        size: 0.12,
      });
    }

    if (p.hp <= 0) {
      playSound('gameover');
      onGameOver(p.score, p.level);
    }
  };

  const gainXP = (amount: number) => {
    const p = stateRef.current.player;
    p.experience += amount;
    if (p.experience >= p.experienceNeeded) {
      p.experience -= p.experienceNeeded;
      p.level += 1;
      p.experienceNeeded = Math.round(p.experienceNeeded * 1.45);
      p.hp = Math.min(p.maxHp, p.hp + 1); // heal 1 HP on level up
      playSound('levelup');

      // Giant vertical fireworks particle flare
      const state = stateRef.current;
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2;
        const blastSpeed = Math.random() * 8 + 6;
        state.particles.push({
          x: p.x,
          y: 0.2,
          z: p.z,
          vx: Math.cos(angle) * blastSpeed,
          vy: Math.random() * 12 + 4,
          vz: Math.sin(angle) * blastSpeed,
          color: '#fbbf24', // golden level flare
          alpha: 1.0,
          decay: 1.5,
          size: Math.random() * 0.22 + 0.12,
        });
      }
    }
  };

  const spawnEnemy = () => {
    const state = stateRef.current;
    const p = state.player;

    // Spawn randomly outside a specific circle around player
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 14 + Math.random() * 6;
    const x = p.x + Math.cos(spawnAngle) * spawnDist;
    const z = p.z + Math.sin(spawnAngle) * spawnDist;

    // Restrict within ground border size 50
    const edge = 23.5;
    const boundedX = Math.max(-edge, Math.min(edge, x));
    const boundedZ = Math.max(-edge, Math.min(edge, z));

    // Determine type difficulty scaling by level
    const roll = Math.random() * 10;
    let type: 'crawler' | 'chaser' | 'shooter' = 'crawler';
    let hp = 30;
    let speed = 2.2;
    let color = '#a855f7'; // Purple crawler
    let scoreValue = 100;

    if (p.level >= 2 && roll > 6.5) {
      type = 'chaser';
      hp = 40;
      speed = 3.5; // Fast chasers
      color = '#f43f5e'; // Crimson stalkers
      scoreValue = 220;
    } else if (p.level >= 3 && roll > 8.5) {
      type = 'shooter';
      hp = 50;
      speed = 1.8;
      color = '#eab308'; // Golden guard turret
      scoreValue = 350;
    }

    state.enemies.push({
      id: `enemy-${Date.now()}-${Math.random()}`,
      x: boundedX,
      y: 0,
      z: boundedZ,
      radius: 0.6,
      hp,
      maxHp: hp,
      type,
      scoreValue,
      color,
      speed,
    });
  };

  const spawnCollectible = () => {
    const state = stateRef.current;
    
    // Spawn randomly inside area 50x50
    const edge = 22;
    const x = (Math.random() - 0.5) * edge * 2;
    const z = (Math.random() - 0.5) * edge * 2;

    const roll = Math.random();
    let type: 'coin' | 'gem' | 'shield' | 'potion' = 'coin';
    let color = '#06b6d4'; // Cyan
    let value = 100;

    if (roll > 0.80) {
      type = 'potion'; // Use potion!
      color = '#ef4444'; // Red health
      value = 1; // 1 HP (1 hit point)
    } else if (roll > 0.65) {
      type = 'shield';
      color = '#fbbf24'; // Golden shield
      value = 0;
    } else if (roll > 0.40) {
      type = 'gem';
      color = '#ec4899'; // Pink gem bonus
      value = 250;
    }

    state.collectibles.push({
      id: `collectible-${Date.now()}`,
      x,
      y: 15, // Starts high up in the sky to fall down!
      z,
      radius: 0.5,
      type,
      color,
      value,
      pulseTime: 0,
    });
  };

  const handleToggleLocalSound = () => {
    const nextVal = !soundOn;
    setSoundOn(nextVal);
    playSound('select');
    settings.soundEnabled = nextVal;
  };

  // Keyboard binding display character helper
  const getBindingChar = (key: string) => {
    if (key === ' ') return 'Space';
    if (key.startsWith('Arrow')) return key.replace('Arrow', '');
    return key.toUpperCase();
  };

  // Touch controls movement helper for mobile testers
  const handleTouchControl = (action: 'up' | 'down' | 'left' | 'right' | 'punch' | 'skill', active: boolean) => {
    const bindings = settings.bindings;
    const keyChar = bindings[action];
    if (active) {
      stateRef.current.keysHeld.add(keyChar.toLowerCase());
    } else {
      stateRef.current.keysHeld.delete(keyChar.toLowerCase());
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col bg-slate-950 overflow-hidden" ref={containerRef}>
      
      {/* Dynamic 3D Gameplay viewport canvas */}
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-crosshair z-10"
      />

      {/* Top Floating HUD Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none select-none">
        
        {/* HUD left player stats panel */}
        <div className="flex items-center gap-4 bg-slate-900/95 border border-slate-800/80 px-4 py-2.5 rounded-2xl backdrop-blur-md pointer-events-auto">
          {/* Health Point Hearts (5 hits max) */}
          <div className="flex items-center gap-1.5 bg-slate-950/45 px-2.5 py-1 rounded-xl border border-slate-800/40">
            {Array.from({ length: hudData.maxHp }).map((_, idx) => {
              const active = idx < hudData.hp;
              return (
                <Heart
                  key={idx}
                  className={`w-4.5 h-4.5 transition-all duration-150 ${
                    active
                      ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]'
                      : 'text-slate-800 fill-transparent'
                  }`}
                />
              );
            })}
            <span className="text-xs font-bold font-mono text-white ml-1 w-6 text-right">
              {hudData.hp}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-800" />

          {/* XP & Level Indicator */}
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <div className="flex flex-col">
              <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                <span>LVL {hudData.level}</span>
                <span className="font-mono">{Math.round(hudData.experience)}/{hudData.experienceNeeded}</span>
              </div>
              <div className="w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${(hudData.experience / hudData.experienceNeeded) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* HUD Center Current Scoreboard */}
        <div className="bg-slate-900/95 border border-slate-800/80 px-5 py-2 rounded-2xl backdrop-blur-md flex flex-col items-center pointer-events-auto">
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">SCORE</span>
          <span className="text-xl font-black text-white font-mono tracking-wider">{hudData.score.toLocaleString()}</span>
        </div>

        {/* HUD Right Actions Control Group */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Mute button */}
          <button
            onClick={handleToggleLocalSound}
            className="p-3 bg-slate-900/95 border border-slate-800/80 hover:border-cyan-500 text-slate-400 hover:text-white rounded-xl transition backdrop-blur-md cursor-pointer"
            title="Toggle Sound"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Pause button */}
          <button
            onClick={() => { playSound('click'); setIsPaused((prev) => !prev); }}
            className="p-3 bg-slate-900/95 border border-slate-800/80 hover:border-cyan-500 text-slate-400 hover:text-white rounded-xl transition backdrop-blur-md cursor-pointer"
            title="Pause Game"
          >
            <Pause className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Floating Tactical Touch Controls for touchscreen users */}
      <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end pointer-events-none select-none md:hidden">
        
        {/* Touch Joystick controller */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900/40 rounded-2xl border border-slate-800/40 backdrop-blur-xs pointer-events-auto">
          <div />
          <button
            onTouchStart={() => handleTouchControl('up', true)}
            onTouchEnd={() => handleTouchControl('up', false)}
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 border border-slate-700 rounded-xl text-cyan-400 font-bold text-xs"
          >
            {getBindingChar(settings.bindings.up)}
          </button>
          <div />
          <button
            onTouchStart={() => handleTouchControl('left', true)}
            onTouchEnd={() => handleTouchControl('left', false)}
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 border border-slate-700 rounded-xl text-cyan-400 font-bold text-xs"
          >
            {getBindingChar(settings.bindings.left)}
          </button>
          <div />
          <button
            onTouchStart={() => handleTouchControl('right', true)}
            onTouchEnd={() => handleTouchControl('right', false)}
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 border border-slate-700 rounded-xl text-cyan-400 font-bold text-xs"
          >
            {getBindingChar(settings.bindings.right)}
          </button>
          <div />
          <button
            onTouchStart={() => handleTouchControl('down', true)}
            onTouchEnd={() => handleTouchControl('down', false)}
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 border border-slate-700 rounded-xl text-cyan-400 font-bold text-xs"
          >
            {getBindingChar(settings.bindings.down)}
          </button>
          <div />
        </div>

        {/* Skill Cooldown circle & Attack Action touch layout */}
        <div className="flex gap-4 items-center pointer-events-auto">
          {/* Skill Blast Trigger */}
          <div className="relative">
            <button
              onTouchStart={() => handleTouchControl('skill', true)}
              onTouchEnd={() => handleTouchControl('skill', false)}
              className="w-14 h-14 bg-amber-600/90 border border-amber-300 rounded-full flex flex-col items-center justify-center text-[10px] text-white font-bold active:scale-90 transition-transform"
            >
              <Zap className="w-4 h-4 mb-0.5" />
              <span>SKILL</span>
            </button>
            {hudData.skillCooldown < 1.0 && (
              <div className="absolute inset-0 bg-slate-950/75 rounded-full flex items-center justify-center text-[9px] font-mono text-amber-400 font-bold">
                {Math.ceil(3.0 * (1.0 - hudData.skillCooldown))}s
              </div>
            )}
          </div>

          {/* Punch/Attack Button */}
          <button
            onTouchStart={() => handleTouchControl('punch', true)}
            onTouchEnd={() => handleTouchControl('punch', false)}
            className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-rose-600 border-2 border-pink-300 rounded-full flex items-center justify-center text-white font-black text-xs uppercase active:scale-90 transition-transform shadow-[0_0_15px_rgba(244,63,94,0.4)]"
          >
            {getBindingChar(settings.bindings.punch)}
          </button>
        </div>
      </div>

      {/* Floating Keyboard Guides overlay for Desktop gamers */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none select-none hidden md:flex flex-col gap-1 text-[10px] text-slate-400 font-mono bg-slate-900/40 border border-slate-800/30 p-3 rounded-xl backdrop-blur-xs">
        <div className="text-cyan-400 font-bold mb-1 border-b border-slate-800/60 pb-1">3D CONTROLS GUIDE</div>
        <div>เดิน (Move): <span className="text-white bg-slate-800/80 px-1 py-0.5 rounded">W/A/S/D</span> หรือ <span className="text-white bg-slate-800/80 px-1 py-0.5 rounded">ปุ่มลูกศร</span></div>
        <div>โจมตี (Punch): <span className="text-pink-400 font-bold bg-pink-950/40 border border-pink-900/30 px-1 py-0.5 rounded">P Key</span></div>
        <div>สกิลวงแหวน (Skill Ring): <span className="text-amber-400 font-bold bg-amber-950/40 border border-amber-900/30 px-1 py-0.5 rounded">O Key</span></div>
        <div>เมนูชั่วคราว (Pause): <span className="text-slate-300 bg-slate-800/80 px-1 py-0.5 rounded">ESC Key</span></div>
      </div>

      {/* PAUSE STATUS POPUP MODAL */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <h2 className="text-2xl font-black text-white tracking-widest uppercase">พักการเล่น (PAUSED)</h2>
            <p className="text-xs text-slate-400">เกมหยุดชั่วคราว คุณสามารถเลือกดำเนินการต่อหรือเริ่มเล่นใหม่ได้</p>
            
            <div className="space-y-3 pt-2">
              <button
                onClick={() => { playSound('select'); setIsPaused(false); }}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                เล่นต่อ (Resume)
              </button>
              
              <button
                onClick={() => {
                  playSound('select');
                  // Reset game session state variables
                  const state = stateRef.current;
                  state.player.hp = 5;
                  state.player.maxHp = 5;
                  state.player.score = 0;
                  state.player.level = 1;
                  state.player.experience = 0;
                  state.player.experienceNeeded = 100;
                  state.player.x = 0;
                  state.player.z = 0;
                  state.enemies = [];
                  state.collectibles = [];
                  state.hitBoxes = [];
                  state.particles = [];
                  state.gameTime = 0;
                  setIsPaused(false);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                <span>เริ่มใหม่ (Restart)</span>
              </button>

              <button
                onClick={() => { playSound('select'); onQuit(); }}
                className="w-full py-3 bg-slate-950 hover:bg-slate-850 text-rose-400 border border-slate-850 hover:border-rose-900/30 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <Home className="w-4 h-4 text-rose-400" />
                <span>กลับหน้าหลัก (Quit to Menu)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
