import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { SFX, resumeAudio } from '../utils/SoundGenerator';
import { networkManager, NetEventType } from '../managers/NetworkManager';

type MenuState = 'main' | 'hosting' | 'joining' | 'waiting' | 'connected';

export class MenuScene extends Phaser.Scene {
  private state: MenuState = 'main';
  private uiContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private codeInput: string = '';
  private inputCursorVisible: boolean = true;
  private inputCursorTimer: number = 0;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.state = 'main';
    this.codeInput = '';

    // Cleanup any prior connection
    networkManager.disconnect();

    // Background particles
    this.createBackgroundParticles();

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 120, 'CHRONO SIEGE', {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: '#ccddff',
      fontStyle: 'bold',
      stroke: '#2244aa',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 190, 'A Time-Bending Tower Defense', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#8899bb',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title,
      scaleX: 1.02, scaleY: 1.02,
      duration: 2000, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Dynamic UI container (changes based on state)
    this.uiContainer = this.add.container(0, 0);

    // Status text (for connection messages)
    this.statusText = this.add.text(GAME_WIDTH / 2, 620, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    // Code display text
    this.codeText = this.add.text(GAME_WIDTH / 2, 400, '', {
      fontSize: '40px', fontFamily: 'monospace', color: '#ffd700',
      fontStyle: 'bold', letterSpacing: 12,
    }).setOrigin(0.5).setDepth(10);

    this.showMainMenu();

    // Keyboard input for join code
    this.input.keyboard!.on('keydown', this.onKeyDown, this);

    // Controls hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Click to place towers | Right-click to cancel | 1-6 to select towers', {
      fontSize: '12px', fontFamily: 'monospace', color: '#445566',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, 'v1.1', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455',
    }).setOrigin(1, 1);

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    // Blink cursor for code input
    if (this.state === 'joining') {
      this.inputCursorTimer += delta;
      if (this.inputCursorTimer > 500) {
        this.inputCursorTimer = 0;
        this.inputCursorVisible = !this.inputCursorVisible;
        this.updateCodeDisplay();
      }
    }
  }

  // ========================
  // MENU STATES
  // ========================

  private showMainMenu(): void {
    this.clearUI();
    this.state = 'main';
    this.statusText.setText('');
    this.codeText.setText('');

    // Solo play
    this.createButton(GAME_WIDTH / 2, 300, 'SOLO PLAY', () => {
      resumeAudio();
      SFX.uiClick();
      networkManager.isMultiplayer = false;
      this.startGame();
    });

    // Host multiplayer
    this.createButton(GAME_WIDTH / 2, 370, 'HOST GAME', () => {
      resumeAudio();
      SFX.uiClick();
      this.startHosting();
    });

    // Join multiplayer
    this.createButton(GAME_WIDTH / 2, 440, 'JOIN GAME', () => {
      resumeAudio();
      SFX.uiClick();
      this.showJoinScreen();
    });

    // Feature list
    const features = [
      'Build mazes to control enemy paths',
      '6 tower types  •  25 waves  •  Co-op multiplayer',
    ];
    features.forEach((text, i) => {
      this.uiContainer.add(
        this.add.text(GAME_WIDTH / 2, 520 + i * 24, text, {
          fontSize: '13px', fontFamily: 'monospace', color: '#556677',
        }).setOrigin(0.5)
      );
    });
  }

  private async startHosting(): Promise<void> {
    this.clearUI();
    this.state = 'hosting';
    this.statusText.setText('Creating room...');

    try {
      const code = await networkManager.hostGame();
      this.state = 'waiting';
      this.codeText.setText(code);

      this.statusText.setText('Share this code with your friend:');

      // Waiting for guest label
      const waitText = this.add.text(GAME_WIDTH / 2, 460, 'Waiting for player to join...', {
        fontSize: '14px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5);
      this.uiContainer.add(waitText);

      // Pulsing dots animation
      let dots = 0;
      const dotTimer = this.time.addEvent({
        delay: 500, loop: true,
        callback: () => {
          dots = (dots + 1) % 4;
          waitText.setText('Waiting for player to join' + '.'.repeat(dots));
        },
      });

      // Back button
      this.createButton(GAME_WIDTH / 2, 540, 'CANCEL', () => {
        SFX.uiClick();
        dotTimer.destroy();
        networkManager.disconnect();
        this.showMainMenu();
      });

      // Listen for connection
      networkManager.onConnected = () => {
        dotTimer.destroy();
        SFX.waveStart();
        this.showConnectedScreen();
      };

      networkManager.onError = (err) => {
        this.statusText.setText(`Error: ${err}`).setColor('#ff4444');
      };

    } catch (err) {
      this.statusText.setText(`Failed to create room: ${err}`).setColor('#ff4444');
      this.time.delayedCall(2000, () => this.showMainMenu());
    }
  }

  private showJoinScreen(): void {
    this.clearUI();
    this.state = 'joining';
    this.codeInput = '';

    this.statusText.setText('Enter the 4-letter room code:');
    this.updateCodeDisplay();

    // Input hint
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 460, 'Type the code and press ENTER', {
        fontSize: '13px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5)
    );

    // Back button
    this.createButton(GAME_WIDTH / 2, 540, 'CANCEL', () => {
      SFX.uiClick();
      this.showMainMenu();
    });
  }

  private async attemptJoin(): Promise<void> {
    if (this.codeInput.length !== 4) {
      this.statusText.setText('Code must be 4 letters').setColor('#ff4444');
      return;
    }

    this.state = 'hosting'; // prevent further input
    this.statusText.setText(`Connecting to ${this.codeInput}...`).setColor('#888888');

    try {
      await networkManager.joinGame(this.codeInput);
      SFX.waveStart();
      this.showConnectedScreen();
    } catch (err) {
      this.statusText.setText(`${err}`).setColor('#ff4444');
      this.time.delayedCall(2000, () => this.showJoinScreen());
    }
  }

  private showConnectedScreen(): void {
    this.clearUI();
    this.state = 'connected';

    const role = networkManager.isHost ? 'HOST' : 'GUEST';
    const color = networkManager.isHost ? '#44aaff' : '#44ff88';

    this.codeText.setText(this.state === 'connected' ? '' : '');
    this.statusText.setText('').setColor('#888888');

    // Connected banner
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 310, 'CONNECTED!', {
        fontSize: '28px', fontFamily: 'monospace', color: '#44ff88', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 350, `You are: Player ${networkManager.playerNumber} (${role})`, {
        fontSize: '16px', fontFamily: 'monospace', color: color,
      }).setOrigin(0.5)
    );

    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 385, `Room: ${networkManager.roomCode}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#888899',
      }).setOrigin(0.5)
    );

    // Start button (host only) or waiting message
    if (networkManager.isHost) {
      this.createButton(GAME_WIDTH / 2, 460, 'START GAME', () => {
        SFX.uiClick();
        networkManager.send(NetEventType.GAME_START);
        this.startGame();
      });
    } else {
      const waitText = this.add.text(GAME_WIDTH / 2, 460, 'Waiting for host to start...', {
        fontSize: '14px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5);
      this.uiContainer.add(waitText);

      // Listen for game start from host
      networkManager.on(NetEventType.GAME_START, () => {
        this.startGame();
      });
    }

    // Cancel button
    this.createButton(GAME_WIDTH / 2, 540, 'LEAVE', () => {
      SFX.uiClick();
      networkManager.disconnect();
      this.showMainMenu();
    });

    // Handle disconnect
    networkManager.onDisconnected = () => {
      this.statusText.setText('Other player disconnected').setColor('#ff4444');
      this.time.delayedCall(2000, () => this.showMainMenu());
    };
  }

  private startGame(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start('GameScene');
    });
  }

  // ========================
  // INPUT
  // ========================

  private onKeyDown(event: KeyboardEvent): void {
    if (this.state !== 'joining') return;

    if (event.key === 'Backspace') {
      this.codeInput = this.codeInput.slice(0, -1);
      SFX.uiClick();
      this.updateCodeDisplay();
      return;
    }

    if (event.key === 'Enter') {
      this.attemptJoin();
      return;
    }

    if (event.key === 'Escape') {
      this.showMainMenu();
      return;
    }

    // Only accept letters
    if (/^[a-zA-Z]$/.test(event.key) && this.codeInput.length < 4) {
      this.codeInput += event.key.toUpperCase();
      SFX.uiClick();
      this.updateCodeDisplay();
    }
  }

  private updateCodeDisplay(): void {
    if (this.state !== 'joining') return;

    const display = this.codeInput.padEnd(4, '_');
    const cursor = this.inputCursorVisible && this.codeInput.length < 4 ? '|' : ' ';
    // Show typed letters with underscores for remaining
    let shown = '';
    for (let i = 0; i < 4; i++) {
      if (i < this.codeInput.length) {
        shown += this.codeInput[i];
      } else if (i === this.codeInput.length && this.inputCursorVisible) {
        shown += '_';
      } else {
        shown += '·';
      }
    }
    this.codeText.setText(shown);
  }

  // ========================
  // UI HELPERS
  // ========================

  private clearUI(): void {
    this.uiContainer.removeAll(true);
    this.codeText.setText('');
  }

  private createButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.image(0, 0, 'btn_normal');
    const text = this.add.text(0, 0, label, {
      fontSize: '20px', fontFamily: 'monospace', color: '#ccddff', fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(200, 50);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.setTexture('btn_hover');
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    container.on('pointerout', () => {
      bg.setTexture('btn_normal');
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });
    container.on('pointerdown', callback);

    // Animate in
    container.setAlpha(0);
    container.y += 15;
    this.tweens.add({
      targets: container, alpha: 1, y: y,
      duration: 400, delay: 100, ease: 'Back.easeOut',
    });

    this.uiContainer.add(container);
    return container;
  }

  private createBackgroundParticles(): void {
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const dot = this.add.graphics();
      dot.fillStyle(0x334466, 0.3 + Math.random() * 0.3);
      dot.fillCircle(0, 0, 1 + Math.random() * 2);
      dot.setPosition(x, y);

      this.tweens.add({
        targets: dot,
        y: y - 30 - Math.random() * 50,
        alpha: 0,
        duration: 3000 + Math.random() * 4000,
        repeat: -1,
        delay: Math.random() * 3000,
        onRepeat: () => {
          dot.setPosition(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10);
          dot.setAlpha(0.3 + Math.random() * 0.3);
        },
      });
    }
  }
}
