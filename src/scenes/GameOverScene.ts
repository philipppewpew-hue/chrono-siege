import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { SFX, resumeAudio } from '../utils/SoundGenerator';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: { victory: boolean; wave: number; lives: number }): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    const isVictory = data.victory;

    // Background particles
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = GAME_HEIGHT + Math.random() * 50;
      const dot = this.add.graphics();
      const color = isVictory ? 0xffd700 : 0xff4444;
      dot.fillStyle(color, 0.3 + Math.random() * 0.4);
      dot.fillCircle(0, 0, 1 + Math.random() * 3);
      dot.setPosition(x, y);

      this.tweens.add({
        targets: dot,
        y: -20,
        alpha: 0,
        duration: 2000 + Math.random() * 3000,
        repeat: -1,
        delay: Math.random() * 2000,
        onRepeat: () => {
          dot.setPosition(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10);
          dot.setAlpha(0.3 + Math.random() * 0.4);
        },
      });
    }

    // Title
    const titleText = isVictory ? 'VICTORY!' : 'DEFEAT';
    const titleColor = isVictory ? '#ffd700' : '#ff4444';
    const strokeColor = isVictory ? '#886600' : '#660000';

    const title = this.add.text(GAME_WIDTH / 2, 180, titleText, {
      fontSize: '72px',
      fontFamily: 'monospace',
      color: titleColor,
      fontStyle: 'bold',
      stroke: strokeColor,
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Dramatic entrance
    title.setScale(0);
    this.tweens.add({
      targets: title,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // Subtitle
    const subtitle = isVictory
      ? 'The timeline is secured!'
      : 'The enemy has breached the defenses.';

    this.add.text(GAME_WIDTH / 2, 260, subtitle, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#8899bb',
    }).setOrigin(0.5);

    // Stats
    const statsY = 320;
    const stats = [
      { label: 'Waves Survived', value: `${data.wave}`, color: '#44aaff' },
      { label: 'Lives Remaining', value: `${data.lives}`, color: data.lives > 0 ? '#44ff44' : '#ff4444' },
    ];

    if (isVictory) {
      stats.push({ label: 'Rating', value: data.lives >= 15 ? 'S RANK' : data.lives >= 10 ? 'A RANK' : data.lives >= 5 ? 'B RANK' : 'C RANK', color: '#ffd700' });
    }

    stats.forEach((stat, i) => {
      const sy = statsY + i * 40;
      this.add.text(GAME_WIDTH / 2 - 100, sy, stat.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#667799',
      }).setAlpha(0).setDepth(1);

      this.add.text(GAME_WIDTH / 2 + 100, sy, stat.value, {
        fontSize: '18px', fontFamily: 'monospace', color: stat.color, fontStyle: 'bold',
      }).setOrigin(1, 0).setAlpha(0).setDepth(1);

      // Animate in
      const texts = this.children.list.slice(-2) as Phaser.GameObjects.Text[];
      texts.forEach(t => {
        this.tweens.add({
          targets: t,
          alpha: 1,
          y: t.y - 10,
          duration: 500,
          delay: 600 + i * 200,
        });
      });
    });

    // Buttons
    const btnY = isVictory ? 500 : 480;

    this.createButton(GAME_WIDTH / 2, btnY, 'PLAY AGAIN', () => {
      resumeAudio();
      SFX.uiClick();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        this.scene.start('GameScene');
      });
    });

    this.createButton(GAME_WIDTH / 2, btnY + 70, 'MAIN MENU', () => {
      SFX.uiClick();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        this.scene.start('MenuScene');
      });
    });

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  private createButton(x: number, y: number, label: string, callback: () => void): void {
    const container = this.add.container(x, y);

    const bg = this.add.image(0, 0, 'btn_normal');
    const text = this.add.text(0, 0, label, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ccddff',
      fontStyle: 'bold',
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

    // Entrance animation
    container.setAlpha(0);
    container.y += 30;
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: y,
      duration: 500,
      delay: 800,
      ease: 'Back.easeOut',
    });
  }
}
