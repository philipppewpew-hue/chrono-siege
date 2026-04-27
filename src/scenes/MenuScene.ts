import * as Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  GameMode, GAME_MODES,
  SpecialistClass, SPECIALISTS, SPECIALIST_ORDER,
} from '../config';
import { SFX, resumeAudio } from '../utils/SoundGenerator';
import { networkManager, NetEventType } from '../managers/NetworkManager';

type MenuState = 'main' | 'mode_select' | 'class_select_solo' | 'hosting' | 'joining' | 'class_select_mp' | 'connected';

export class MenuScene extends Phaser.Scene {
  private state: MenuState = 'main';
  private uiContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private codeInput: string = '';
  private inputCursorVisible: boolean = true;
  private inputCursorTimer: number = 0;
  private selectedMode: GameMode = 'coop';
  private myClass: SpecialistClass = 'commander';

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.state = 'main';
    this.codeInput = '';
    this.selectedMode = 'coop';
    this.myClass = 'commander';

    networkManager.disconnect();

    this.createBackgroundParticles();

    const title = this.add.text(GAME_WIDTH / 2, 90, 'CHRONO SIEGE', {
      fontSize: '56px', fontFamily: 'monospace', color: '#ccddff',
      fontStyle: 'bold', stroke: '#2244aa', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 150, 'A Time-Bending Tower Defense', {
      fontSize: '16px', fontFamily: 'monospace', color: '#8899bb',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title,
      scaleX: 1.02, scaleY: 1.02,
      duration: 2000, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.uiContainer = this.add.container(0, 0);

    this.statusText = this.add.text(GAME_WIDTH / 2, 660, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    this.codeText = this.add.text(GAME_WIDTH / 2, 360, '', {
      fontSize: '40px', fontFamily: 'monospace', color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.showMainMenu();

    this.input.keyboard!.on('keydown', this.onKeyDown, this);

    this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, 'v1.2', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455',
    }).setOrigin(1, 1);

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
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
  // SCREENS
  // ========================

  private showMainMenu(): void {
    this.clearUI();
    this.state = 'main';
    this.statusText.setText('');
    this.codeText.setText('');

    this.createButton(GAME_WIDTH / 2, 260, 'SOLO PLAY', () => {
      resumeAudio();
      SFX.uiClick();
      networkManager.isMultiplayer = false;
      networkManager.gameMode = 'solo';
      this.showClassSelectSolo();
    });

    this.createButton(GAME_WIDTH / 2, 330, 'HOST GAME', () => {
      resumeAudio();
      SFX.uiClick();
      this.showModeSelect();
    });

    this.createButton(GAME_WIDTH / 2, 400, 'JOIN GAME', () => {
      resumeAudio();
      SFX.uiClick();
      this.showJoinScreen();
    });

    const features = [
      'Build mazes  •  6 tower types  •  4 specialist classes',
      'Solo  •  Co-op  •  Send Mode  •  Split Lanes',
    ];
    features.forEach((text, i) => {
      this.uiContainer.add(
        this.add.text(GAME_WIDTH / 2, 510 + i * 24, text, {
          fontSize: '13px', fontFamily: 'monospace', color: '#556677',
        }).setOrigin(0.5)
      );
    });
  }

  // === Mode select (host only) ===
  private showModeSelect(): void {
    this.clearUI();
    this.state = 'mode_select';
    this.statusText.setText('');

    // === COOPERATIVE LABEL ===
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 220, '— COOPERATIVE —', {
        fontSize: '14px', fontFamily: 'monospace', color: '#88ccaa', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // Co-op + Split Lanes side by side
    const cardW = 300, cardH = 110;
    const cardGap = 24;
    const coopX = GAME_WIDTH / 2 - (cardW + cardGap) / 2;
    const splitX = GAME_WIDTH / 2 + (cardW + cardGap) / 2;
    const coopY = 300;

    this.makeModeCard(coopX, coopY, cardW, cardH, 'coop', 0x44ccaa, 0);
    this.makeModeCard(splitX, coopY, cardW, cardH, 'splitlanes', 0x44aaff, 1);

    // === COMPETITIVE LABEL ===
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 430, '— COMPETITIVE —', {
        fontSize: '14px', fontFamily: 'monospace', color: '#ff8866', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // Send mode below, marked as competitive
    this.makeModeCard(GAME_WIDTH / 2, 510, cardW * 1.5 + cardGap, cardH, 'send', 0xff6644, 2);

    this.createButton(GAME_WIDTH / 2, 580, 'BACK', () => {
      SFX.uiClick();
      this.showMainMenu();
    });
  }

  // === Class select for solo play ===
  private showClassSelectSolo(): void {
    this.clearUI();
    this.state = 'class_select_solo';
    this.statusText.setText('Choose your specialist:');

    this.renderClassPicker(280, (cls) => {
      this.myClass = cls;
      networkManager.myClass = cls;
      SFX.uiClick();
      this.startGame();
    });

    this.createButton(GAME_WIDTH / 2, 580, 'BACK', () => {
      SFX.uiClick();
      this.showMainMenu();
    });
  }

  // === Class select for multiplayer ===
  private showClassSelectMP(): void {
    this.clearUI();
    this.state = 'class_select_mp';

    const role = networkManager.isHost ? 'HOST (P1)' : 'GUEST (P2)';
    const color = networkManager.isHost ? '#44aaff' : '#44ff88';
    const modeName = GAME_MODES[networkManager.gameMode].name;

    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 200, `${modeName.toUpperCase()}  —  Room ${networkManager.roomCode}`, {
        fontSize: '16px', fontFamily: 'monospace', color: '#aabbcc',
      }).setOrigin(0.5)
    );
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 224, `You are ${role}`, {
        fontSize: '14px', fontFamily: 'monospace', color: color,
      }).setOrigin(0.5)
    );

    this.statusText.setText('Choose your specialist:');

    this.renderClassPicker(290, (cls) => {
      this.myClass = cls;
      networkManager.myClass = cls;
      SFX.uiClick();
      networkManager.send(NetEventType.CLASS_CHANGE, { class: cls });
      this.showLobbyReady();
    });

    this.createButton(GAME_WIDTH / 2, 600, 'LEAVE', () => {
      SFX.uiClick();
      networkManager.disconnect();
      this.showMainMenu();
    });
  }

  private showLobbyReady(): void {
    this.clearUI();
    this.state = 'connected';

    const myDef = SPECIALISTS[networkManager.myClass];
    const peerDef = SPECIALISTS[networkManager.peerClass];

    const modeName = GAME_MODES[networkManager.gameMode].name;
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 200, `${modeName.toUpperCase()}  —  Room ${networkManager.roomCode}`, {
        fontSize: '16px', fontFamily: 'monospace', color: '#aabbcc',
      }).setOrigin(0.5)
    );

    // P1 card
    const p1IsMe = networkManager.isHost;
    const p1Class = p1IsMe ? myDef : peerDef;
    this.renderPlayerCard(GAME_WIDTH / 2 - 180, 320, 1, p1Class, p1IsMe);

    // VS text
    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 320, networkManager.gameMode === 'send' ? 'VS' : '+', {
        fontSize: '36px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // P2 card
    const p2IsMe = !networkManager.isHost;
    const p2Class = p2IsMe ? myDef : peerDef;
    this.renderPlayerCard(GAME_WIDTH / 2 + 180, 320, 2, p2Class, p2IsMe);

    if (networkManager.isHost) {
      this.createButton(GAME_WIDTH / 2, 510, 'START GAME', () => {
        SFX.uiClick();
        networkManager.send(NetEventType.GAME_START);
        this.startGame();
      });
    } else {
      const waitText = this.add.text(GAME_WIDTH / 2, 510, 'Waiting for host to start...', {
        fontSize: '14px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5);
      this.uiContainer.add(waitText);

      let dots = 0;
      this.time.addEvent({
        delay: 500, loop: true,
        callback: () => {
          if (this.state !== 'connected') return;
          dots = (dots + 1) % 4;
          waitText.setText('Waiting for host to start' + '.'.repeat(dots));
        },
      });

      networkManager.on(NetEventType.GAME_START, () => {
        this.startGame();
      });
    }

    // Change class button
    this.createButton(GAME_WIDTH / 2, 580, 'CHANGE CLASS', () => {
      SFX.uiClick();
      this.showClassSelectMP();
    });

    networkManager.onDisconnected = () => {
      this.statusText.setText('Other player disconnected').setColor('#ff4444');
      this.time.delayedCall(2000, () => this.showMainMenu());
    };
  }

  private renderPlayerCard(x: number, y: number, playerNum: number, cls: any, isMe: boolean): void {
    const card = this.add.container(x, y).setDepth(5);
    const w = 220, h = 160;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, isMe ? cls.color : 0x445566, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const label = this.add.text(0, -h / 2 + 16, `P${playerNum}${isMe ? ' (YOU)' : ''}`, {
      fontSize: '14px', fontFamily: 'monospace',
      color: isMe ? '#ffd700' : '#888899',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const className = this.add.text(0, -20, cls.name.toUpperCase(), {
      fontSize: '20px', fontFamily: 'monospace',
      color: Phaser.Display.Color.IntegerToColor(cls.color).rgba,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, 16, cls.description, {
      fontSize: '11px', fontFamily: 'monospace', color: '#aabbcc',
      wordWrap: { width: w - 24 }, align: 'center',
    }).setOrigin(0.5);

    const ability = this.add.text(0, 50, `Ability: ${cls.abilityName}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5);

    card.add([bg, label, className, desc, ability]);
    this.uiContainer.add(card);
  }

  private makeModeCard(x: number, y: number, w: number, h: number, mode: GameMode, accentColor: number, animOrder: number): void {
    const def = GAME_MODES[mode];
    const card = this.add.container(x, y).setDepth(5);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x2a2a4e : 0x1a1a2e, 0.9);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      bg.lineStyle(2, accentColor, hover ? 1 : 0.7);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    };
    drawBg(false);

    const name = this.add.text(0, -28, def.name.toUpperCase(), {
      fontSize: '22px', fontFamily: 'monospace',
      color: Phaser.Display.Color.IntegerToColor(accentColor).rgba,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, 12, def.description, {
      fontSize: '12px', fontFamily: 'monospace', color: '#aabbcc',
      wordWrap: { width: w - 24 }, align: 'center',
    }).setOrigin(0.5);

    card.add([bg, name, desc]);
    // setSize centered on container origin — hit area matches visual exactly
    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });

    card.on('pointerover', () => drawBg(true));
    card.on('pointerout', () => drawBg(false));
    card.on('pointerup', () => {
      SFX.uiClick();
      this.selectedMode = mode;
      networkManager.gameMode = mode;
      this.startHosting();
    });

    this.uiContainer.add(card);

    card.setAlpha(0);
    card.y += 15;
    this.tweens.add({
      targets: card, alpha: 1, y: y,
      duration: 350, delay: 80 + animOrder * 70, ease: 'Back.easeOut',
    });
  }

  private renderClassPicker(startY: number, onPick: (cls: SpecialistClass) => void): void {
    const cardWidth = 240, cardHeight = 130;
    const spacing = 16;
    const totalWidth = cardWidth * 2 + spacing;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + cardWidth / 2;

    SPECIALIST_ORDER.forEach((cls, i) => {
      const def = SPECIALISTS[cls];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardWidth + spacing);
      const y = startY + row * (cardHeight + spacing);

      const card = this.add.container(x, y).setDepth(5);

      const bg = this.add.graphics();
      const drawBg = (hover: boolean) => {
        bg.clear();
        bg.fillStyle(hover ? 0x2a2a4e : 0x1a1a2e, 0.9);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
        bg.lineStyle(2, def.color, hover ? 1 : 0.7);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      };
      drawBg(false);

      const name = this.add.text(0, -45, def.name.toUpperCase(), {
        fontSize: '20px', fontFamily: 'monospace',
        color: Phaser.Display.Color.IntegerToColor(def.color).rgba,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const desc = this.add.text(0, -16, def.description, {
        fontSize: '11px', fontFamily: 'monospace', color: '#aabbcc',
        wordWrap: { width: cardWidth - 20 }, align: 'center',
      }).setOrigin(0.5);

      const abilityLine = this.add.text(0, 20, `${def.abilityName}`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0.5);

      const abilityDesc = this.add.text(0, 42, def.abilityDescription, {
        fontSize: '10px', fontFamily: 'monospace', color: '#88aabb',
        wordWrap: { width: cardWidth - 20 }, align: 'center',
      }).setOrigin(0.5);

      card.add([bg, name, desc, abilityLine, abilityDesc]);
      card.setSize(cardWidth, cardHeight);
      card.setInteractive({ useHandCursor: true });

      card.on('pointerover', () => drawBg(true));
      card.on('pointerout', () => drawBg(false));
      card.on('pointerup', () => onPick(cls));

      this.uiContainer.add(card);

      card.setAlpha(0);
      this.tweens.add({
        targets: card, alpha: 1,
        duration: 300, delay: 80 + i * 60, ease: 'Quad.easeOut',
      });
    });
  }

  // === Hosting (creates room) ===
  private async startHosting(): Promise<void> {
    this.clearUI();
    this.state = 'hosting';
    this.statusText.setText('Creating room...').setColor('#888888');

    try {
      const code = await networkManager.hostGame();
      this.codeText.setText(code);

      this.statusText.setText('Share this code with your friend:');

      const modeText = this.add.text(GAME_WIDTH / 2, 280, `Mode: ${GAME_MODES[this.selectedMode].name}`, {
        fontSize: '15px', fontFamily: 'monospace', color: '#88aabb',
      }).setOrigin(0.5);
      this.uiContainer.add(modeText);

      const waitText = this.add.text(GAME_WIDTH / 2, 460, 'Waiting for player to join...', {
        fontSize: '14px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5);
      this.uiContainer.add(waitText);

      let dots = 0;
      const dotTimer = this.time.addEvent({
        delay: 500, loop: true,
        callback: () => {
          dots = (dots + 1) % 4;
          waitText.setText('Waiting for player to join' + '.'.repeat(dots));
        },
      });

      this.createButton(GAME_WIDTH / 2, 540, 'CANCEL', () => {
        SFX.uiClick();
        dotTimer.destroy();
        networkManager.disconnect();
        this.showMainMenu();
      });

      // Listen for class change broadcasts
      networkManager.on(NetEventType.CLASS_CHANGE, (event) => {
        networkManager.peerClass = event.data.class;
        if (this.state === 'connected') {
          // refresh lobby display
          this.showLobbyReady();
        }
      });

      networkManager.onConnected = () => {
        dotTimer.destroy();
        SFX.waveStart();
        // Send mode info to guest immediately
        networkManager.send(NetEventType.MODE_CHANGE, { mode: this.selectedMode });
        // Send our class
        networkManager.send(NetEventType.CLASS_CHANGE, { class: networkManager.myClass });
        this.showClassSelectMP();
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

    this.uiContainer.add(
      this.add.text(GAME_WIDTH / 2, 460, 'Type the code and press ENTER', {
        fontSize: '13px', fontFamily: 'monospace', color: '#667799',
      }).setOrigin(0.5)
    );

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

    this.state = 'hosting';
    this.statusText.setText(`Connecting to ${this.codeInput}...`).setColor('#888888');

    try {
      // Listen for mode and class messages from host
      networkManager.on(NetEventType.MODE_CHANGE, (event) => {
        networkManager.gameMode = event.data.mode;
      });
      networkManager.on(NetEventType.CLASS_CHANGE, (event) => {
        networkManager.peerClass = event.data.class;
        if (this.state === 'connected') {
          this.showLobbyReady();
        }
      });

      await networkManager.joinGame(this.codeInput);
      SFX.waveStart();
      // After connection, wait briefly for mode info to arrive
      this.time.delayedCall(300, () => {
        // Send my class
        networkManager.send(NetEventType.CLASS_CHANGE, { class: networkManager.myClass });
        this.showClassSelectMP();
      });
    } catch (err) {
      this.statusText.setText(`${err}`).setColor('#ff4444');
      this.time.delayedCall(2000, () => this.showJoinScreen());
    }
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

    if (/^[a-zA-Z]$/.test(event.key) && this.codeInput.length < 4) {
      this.codeInput += event.key.toUpperCase();
      SFX.uiClick();
      this.updateCodeDisplay();
    }
  }

  private updateCodeDisplay(): void {
    if (this.state !== 'joining') return;
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
    container.on('pointerup', callback);

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
