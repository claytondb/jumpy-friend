// Jumpy Friend - Hold-to-Jump Platformer

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        this.load.image('character', 'assets/character.png');
    }

    create() {
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4AA8D8, 0x4AA8D8, 1);
        graphics.fillRect(0, 0, 400, 600);

        this.add.text(50, 50, '☁️', { fontSize: '48px' }).setAlpha(0.6);
        this.add.text(280, 80, '☁️', { fontSize: '32px' }).setAlpha(0.5);

        this.character = this.add.image(200, 280, 'character').setScale(1.5);
        this.tweens.add({
            targets: this.character,
            y: 260,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.add.text(200, 80, 'Jumpy Friend', {
            fontSize: '42px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#4CAF50',
            stroke: '#2d5a27',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(200, 150, 'HOLD to charge\nRELEASE to jump!', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);

        const difficulties = [
            { name: 'Easy', y: 380, color: 0x4CAF50 },
            { name: 'Medium', y: 440, color: 0xFF9800 },
            { name: 'Hard', y: 500, color: 0xF44336 }
        ];

        difficulties.forEach(diff => {
            const btn = this.add.graphics();
            btn.fillStyle(diff.color, 1);
            btn.fillRoundedRect(100, diff.y - 22, 200, 44, 12);

            this.add.text(200, diff.y, diff.name, {
                fontSize: '24px',
                fontFamily: 'Arial Black, sans-serif',
                fill: '#fff'
            }).setOrigin(0.5);

            const zone = this.add.zone(200, diff.y, 200, 44).setInteractive();
            zone.on('pointerdown', () => {
                this.scene.start('GameScene', { difficulty: diff.name.toLowerCase() });
            });
        });

        const best = localStorage.getItem('jumpyfriend_highscore') || '0';
        this.add.text(200, 560, `Best: ${best}`, {
            fontSize: '18px',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 2
        }).setOrigin(0.5);
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.difficulty = data.difficulty || 'easy';
    }

    preload() {
        this.load.image('character', 'assets/character.png');
    }

    create() {
        // Background
        this.bg = this.add.graphics();
        this.drawBackground();

        // State
        this.score = 0;
        this.maxHeight = 600;
        this.gameOver = false;
        this.jumpCount = 0;
        
        // CHARGING STATE
        this.charging = false;
        this.chargeStart = 0;

        // Settings per difficulty
        const settings = {
            easy: { gap: 90, width: 100, moving: 0.1, speed: 100 },
            medium: { gap: 110, width: 80, moving: 0.25, speed: 120 },
            hard: { gap: 130, width: 65, moving: 0.4, speed: 140 }
        };
        this.settings = settings[this.difficulty];

        // Platforms
        this.platforms = this.physics.add.staticGroup();
        this.movingPlatforms = this.physics.add.group({ allowGravity: false, immovable: true });

        // Ground
        this.createPlatform(200, 560, 200);

        // Initial platforms
        let y = 470;
        for (let i = 0; i < 10; i++) {
            y -= Phaser.Math.Between(this.settings.gap - 20, this.settings.gap + 20);
            this.createPlatform(
                Phaser.Math.Between(80, 320),
                y,
                this.settings.width,
                Math.random() < this.settings.moving
            );
        }
        this.topPlatformY = y;

        // Character
        this.player = this.physics.add.sprite(200, 500, 'character');
        this.player.setScale(0.5);
        this.player.body.setSize(50, 60);
        this.player.body.setOffset(39, 68);
        this.player.setCollideWorldBounds(false);
        this.player.setVelocityX(this.settings.speed);

        // Collisions
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.player, this.movingPlatforms);

        // ========== INPUT ==========
        // Pointer (mouse/touch)
        this.input.on('pointerdown', () => this.startCharge());
        this.input.on('pointerup', () => this.doJump());
        
        // Keyboard
        this.spaceKey = this.input.keyboard.addKey('SPACE');

        // ========== UI ==========
        // Score
        this.scoreText = this.add.text(200, 30, '0', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0);

        // Charge meter background
        this.meterBg = this.add.graphics().setScrollFactor(0);
        this.meterBg.fillStyle(0x000000, 0.6);
        this.meterBg.fillRoundedRect(50, 520, 300, 50, 25);

        // Charge meter fill
        this.meterFill = this.add.graphics().setScrollFactor(0);

        // Charge text
        this.chargeLabel = this.add.text(200, 545, 'TAP & HOLD TO CHARGE', {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        // Camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 80);
        this.cameras.main.setBounds(0, -99999, 400, 999999);
    }

    createPlatform(x, y, width, moving = false) {
        const g = this.make.graphics();
        g.fillStyle(0x8B4513);
        g.fillRoundedRect(0, 10, width, 14, 4);
        g.fillStyle(0x228B22);
        g.fillRoundedRect(0, 0, width, 14, 6);
        g.fillStyle(0x32CD32);
        g.fillRoundedRect(4, 2, width - 8, 6, 3);

        const key = `plat_${width}`;
        if (!this.textures.exists(key)) {
            g.generateTexture(key, width, 24);
        }
        g.destroy();

        if (moving) {
            const p = this.movingPlatforms.create(x, y, key);
            p.body.setSize(width, 14).setOffset(0, 5);
            p.setVelocityX(Phaser.Math.Between(50, 100) * (Math.random() > 0.5 ? 1 : -1));
            p.setData('left', x - 60);
            p.setData('right', x + 60);
        } else {
            const p = this.platforms.create(x, y, key);
            p.body.setSize(width, 14).setOffset(0, 5);
            p.refreshBody();
        }
    }

    startCharge() {
        if (this.gameOver) return;
        
        // Always allow starting charge
        this.charging = true;
        this.chargeStart = this.time.now;
        this.chargeLabel.setText('CHARGING...');
        
        // Visual squish
        this.tweens.killTweensOf(this.player);
        this.tweens.add({
            targets: this.player,
            scaleY: 0.35,
            scaleX: 0.6,
            duration: 100
        });
    }

    doJump() {
        if (this.gameOver || !this.charging) return;
        
        // Calculate charge (0 to 1 over 1 second)
        const chargeTime = (this.time.now - this.chargeStart) / 1000;
        const power = Math.min(chargeTime, 1);
        
        this.charging = false;
        
        // Only jump if on ground
        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        
        if (onGround) {
            // JUMP!
            const velocity = -350 - (power * 400); // -350 to -750
            this.player.setVelocityY(velocity);
            this.jumpCount++;
        }
        
        // Reset visuals
        this.meterFill.clear();
        this.chargeLabel.setText('TAP & HOLD TO CHARGE');
        
        this.tweens.killTweensOf(this.player);
        this.tweens.add({
            targets: this.player,
            scaleY: 0.5,
            scaleX: 0.5,
            duration: 100
        });
    }

    update() {
        if (this.gameOver) return;

        // Keyboard
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.startCharge();
        }
        if (Phaser.Input.Keyboard.JustUp(this.spaceKey)) {
            this.doJump();
        }

        // Update charge meter while charging
        if (this.charging) {
            const chargeTime = (this.time.now - this.chargeStart) / 1000;
            const power = Math.min(chargeTime, 1);
            const pct = Math.floor(power * 100);

            this.meterFill.clear();
            
            // Color: green -> yellow -> gold
            let color;
            if (power < 0.5) {
                color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    { r: 76, g: 175, b: 80 },
                    { r: 255, g: 235, b: 59 },
                    100, pct * 2
                );
            } else {
                color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    { r: 255, g: 235, b: 59 },
                    { r: 255, g: 193, b: 7 },
                    100, (pct - 50) * 2
                );
            }
            
            this.meterFill.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
            this.meterFill.fillRoundedRect(55, 525, 290 * power, 40, 20);

            if (power >= 1) {
                this.chargeLabel.setText('MAX POWER!');
            } else {
                this.chargeLabel.setText(`${pct}%`);
            }
        }

        // Wall bounce
        if (this.player.x < 25) {
            this.player.x = 25;
            this.player.setVelocityX(Math.abs(this.player.body.velocity.x));
            this.player.setFlipX(false);
        } else if (this.player.x > 375) {
            this.player.x = 375;
            this.player.setVelocityX(-Math.abs(this.player.body.velocity.x));
            this.player.setFlipX(true);
        }

        // Moving platforms bounce
        this.movingPlatforms.children.iterate(p => {
            if (!p) return;
            if (p.x <= p.getData('left') || p.x >= p.getData('right')) {
                p.setVelocityX(-p.body.velocity.x);
            }
        });

        // Generate platforms above
        while (this.topPlatformY > this.cameras.main.scrollY - 200) {
            this.topPlatformY -= Phaser.Math.Between(this.settings.gap - 20, this.settings.gap + 20);
            this.createPlatform(
                Phaser.Math.Between(80, 320),
                this.topPlatformY,
                this.settings.width,
                Math.random() < this.settings.moving
            );
        }

        // Remove platforms below
        const bottomY = this.cameras.main.scrollY + 700;
        this.platforms.children.iterate(p => { if (p && p.y > bottomY) p.destroy(); });
        this.movingPlatforms.children.iterate(p => { if (p && p.y > bottomY) p.destroy(); });

        // Score
        if (this.player.y < this.maxHeight) {
            this.maxHeight = this.player.y;
            this.score = Math.floor((600 - this.maxHeight) / 10);
            this.scoreText.setText(this.score);
        }

        // Background
        this.drawBackground();

        // Death
        if (this.player.y > this.cameras.main.scrollY + 650) {
            this.endGame();
        }
    }

    drawBackground() {
        const h = Math.abs(this.cameras.main.scrollY);
        let top = 0x87CEEB, bot = 0xADD8E6;
        if (h > 2000) { top = 0x5DADE2; bot = 0x87CEEB; }
        if (h > 5000) { top = 0x3498DB; bot = 0x5DADE2; }
        if (h > 10000) { top = 0x1A5276; bot = 0x3498DB; }

        this.bg.clear();
        this.bg.fillGradientStyle(top, top, bot, bot, 1);
        this.bg.fillRect(0, this.cameras.main.scrollY - 50, 400, 700);
        this.bg.setDepth(-1);
    }

    endGame() {
        if (this.gameOver) return;
        this.gameOver = true;

        const best = parseInt(localStorage.getItem('jumpyfriend_highscore') || '0');
        if (this.score > best) {
            localStorage.setItem('jumpyfriend_highscore', this.score);
        }

        // Overlay
        const ov = this.add.graphics().setScrollFactor(0);
        ov.fillStyle(0x000000, 0.8);
        ov.fillRect(0, 0, 400, 600);

        this.add.text(200, 150, 'GAME OVER', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            fill: '#F44336'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 230, `Score: ${this.score}`, {
            fontSize: '36px',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 280, `Jumps: ${this.jumpCount}`, {
            fontSize: '20px',
            fill: '#aaa'
        }).setOrigin(0.5).setScrollFactor(0);

        if (this.score >= best && this.score > 0) {
            this.add.text(200, 330, '🏆 NEW BEST! 🏆', {
                fontSize: '28px',
                fill: '#FFD700'
            }).setOrigin(0.5).setScrollFactor(0);
        }

        // Buttons
        this.createButton(200, 420, 'Play Again', 0x4CAF50, () => {
            this.scene.restart({ difficulty: this.difficulty });
        });

        this.createButton(200, 500, 'Menu', 0x607D8B, () => {
            this.scene.start('MenuScene');
        });
    }

    createButton(x, y, text, color, callback) {
        const g = this.add.graphics().setScrollFactor(0);
        g.fillStyle(color, 1);
        g.fillRoundedRect(x - 100, y - 25, 200, 50, 12);

        this.add.text(x, y, text, {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const zone = this.add.zone(x, y, 200, 50).setInteractive().setScrollFactor(0);
        zone.on('pointerdown', callback);
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 400,
    height: 600,
    backgroundColor: '#87CEEB',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 900 }, debug: false }
    },
    scene: [MenuScene, GameScene]
};

new Phaser.Game(config);
