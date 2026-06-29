export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  punch: string;
  skill: string;
}

export type ControlPreset = 'arrows' | 'wasd' | 'custom';

export interface GameSettings {
  bindings: KeyBindings;
  preset: ControlPreset;
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface HighScore {
  name: string;
  score: number;
  date: string;
}

export type GameState = 'START' | 'OPTIONS' | 'PLAYING' | 'GAMEOVER' | 'PAUSED' | 'ENDING';

export interface Entity3D {
  id: string;
  x: number; // mapped to 3D X
  z: number; // mapped to 3D Z (floor position)
  y: number; // mapped to 3D Y (height)
  radius: number; // collision radius
  speedX?: number;
  speedZ?: number;
}

export interface Player extends Entity3D {
  hp: number;
  maxHp: number;
  score: number;
  level: number;
  experience: number;
  experienceNeeded: number;
  speed: number;
  lastPunchTime: number;
  lastSkillTime: number;
  invulnerableUntil: number;
  currentAction: 'idle' | 'walk' | 'attack' | 'dance';
}

export interface Enemy extends Entity3D {
  hp: number;
  maxHp: number;
  type: 'crawler' | 'chaser' | 'shooter' | 'boss';
  scoreValue: number;
  color: string;
  speed: number;
  hitsReceived?: number;
  hitFlashTime?: number; // >0 means flashing red or white
  isDying?: boolean;
  dyingTimer?: number;
  deathVx?: number;
  deathVy?: number;
  deathVz?: number;
  facingLeft?: boolean;
  bossState?: 'IDLE' | 'DASH' | 'PREPARE' | 'ATTACK';
  bossStateTimer?: number;
  bossScaleX?: number;
  bossScaleY?: number;
  bossTargetX?: number;
  bossTargetZ?: number;
  fireballTimer?: number;
  hitBoxesAlreadyHit?: string[];
}

export interface Collectible extends Entity3D {
  type: 'coin' | 'gem' | 'heart' | 'shield' | 'potion';
  value: number;
  color: string;
  pulseTime: number;
}

export interface HitBox3D {
  id: string;
  x: number;
  z: number;
  radius: number;
  lifeTime: number;
  maxLifeTime: number;
  color: string;
  isExpandingRing?: boolean; // Skill Ring
}

export interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
}

export interface Fireball extends Entity3D {
  targetX: number;
  targetZ: number;
  maxHeight: number;
  lifeTime: number;
  maxLifeTime: number; // Trajectory time (e.g. 1.8 seconds)
  damageDealt?: boolean;
}

export interface WarpGate extends Entity3D {
  active: boolean;
  pulseTime: number;
}
