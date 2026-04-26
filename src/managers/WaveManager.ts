import { WaveDef, generateWaves, ENEMIES, WAVE_BREAK_TIME } from '../config';

export interface WaveSpawn {
  enemyType: string;
  time: number;  // ms from wave start
  hpScale: number;
  speedScale: number;
}

export class WaveManager {
  public currentWave: number = 0;
  public isWaveActive: boolean = false;
  public isAllWavesDone: boolean = false;
  public waveBreakTimer: number = 0;
  public waveBreakDuration: number = WAVE_BREAK_TIME;

  private waves: WaveDef[];
  private spawnQueue: WaveSpawn[] = [];
  private spawnTimer: number = 0;
  private spawnIndex: number = 0;
  private enemiesSpawned: number = 0;
  private enemiesInWave: number = 0;
  private enemiesKilledOrPassed: number = 0;

  private onSpawn: ((type: string, hpScale: number, speedScale: number) => void) | null = null;
  private onWaveComplete: ((waveNum: number, bonusGold: number) => void) | null = null;
  private onAllWavesComplete: (() => void) | null = null;

  constructor() {
    this.waves = generateWaves();
  }

  setCallbacks(
    onSpawn: (type: string, hpScale: number, speedScale: number) => void,
    onWaveComplete: (waveNum: number, bonusGold: number) => void,
    onAllWavesComplete: () => void
  ): void {
    this.onSpawn = onSpawn;
    this.onWaveComplete = onWaveComplete;
    this.onAllWavesComplete = onAllWavesComplete;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get waveProgress(): number {
    if (!this.isWaveActive || this.enemiesInWave === 0) return 0;
    return this.enemiesKilledOrPassed / this.enemiesInWave;
  }

  get currentWaveDef(): WaveDef | null {
    if (this.currentWave <= 0 || this.currentWave > this.waves.length) return null;
    return this.waves[this.currentWave - 1];
  }

  get nextWaveDef(): WaveDef | null {
    if (this.currentWave >= this.waves.length) return null;
    return this.waves[this.currentWave];
  }

  getWavePreview(): string[] {
    const wave = this.nextWaveDef;
    if (!wave) return [];
    return wave.entries.map(e => {
      const def = ENEMIES[e.enemyType];
      return `${def.name} x${e.count}`;
    });
  }

  startNextWave(): boolean {
    if (this.isWaveActive) return false;
    if (this.currentWave >= this.waves.length) return false;

    this.currentWave++;
    this.isWaveActive = true;
    this.enemiesKilledOrPassed = 0;

    const waveDef = this.waves[this.currentWave - 1];

    // Build spawn queue with absolute timing
    this.spawnQueue = [];
    let currentTime = 0;

    for (const entry of waveDef.entries) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          enemyType: entry.enemyType,
          time: currentTime,
          hpScale: entry.hpScale ?? 1,
          speedScale: entry.speedScale ?? 1,
        });
        currentTime += entry.delay;
      }
    }

    // Sort by time for proper ordering
    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.enemiesInWave = this.spawnQueue.length;
    this.enemiesSpawned = 0;
    this.spawnIndex = 0;
    this.spawnTimer = 0;

    return true;
  }

  enemyHandled(): void {
    this.enemiesKilledOrPassed++;
    this.checkWaveComplete();
  }

  private checkWaveComplete(): void {
    if (!this.isWaveActive) return;
    if (this.enemiesKilledOrPassed >= this.enemiesInWave && this.spawnIndex >= this.spawnQueue.length) {
      this.isWaveActive = false;

      const waveDef = this.waves[this.currentWave - 1];
      if (this.onWaveComplete) {
        this.onWaveComplete(this.currentWave, waveDef.bonusGold);
      }

      if (this.currentWave >= this.waves.length) {
        this.isAllWavesDone = true;
        if (this.onAllWavesComplete) {
          this.onAllWavesComplete();
        }
      } else {
        this.waveBreakTimer = this.waveBreakDuration;
      }
    }
  }

  update(delta: number): void {
    // Wave break countdown
    if (!this.isWaveActive && this.waveBreakTimer > 0) {
      this.waveBreakTimer -= delta;
      if (this.waveBreakTimer <= 0) {
        this.waveBreakTimer = 0;
        this.startNextWave();
      }
    }

    if (!this.isWaveActive) return;
    if (this.spawnIndex >= this.spawnQueue.length) return;

    this.spawnTimer += delta;

    // Spawn enemies when their time comes
    while (this.spawnIndex < this.spawnQueue.length && this.spawnTimer >= this.spawnQueue[this.spawnIndex].time) {
      const spawn = this.spawnQueue[this.spawnIndex];
      if (this.onSpawn) {
        this.onSpawn(spawn.enemyType, spawn.hpScale, spawn.speedScale);
      }
      this.enemiesSpawned++;
      this.spawnIndex++;
    }
  }
}
