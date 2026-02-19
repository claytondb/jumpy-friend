// Jumpy Friend - Hold-to-Jump Platformer

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4AA8D8, 0x4AA8D8, 1);
        graphics.fillRect(0, 0, 800, 1200);

        this.add.text(100, 100, '☁️', { fontSize: '96px' }).setAlpha(0.6);
        this.add.text(560, 160, '☁️', { fontSize: '64px' }).setAlpha(0.5);

        // Draw the character (green square with smiley)
        this.drawCharacter(400, 560, 3);

        this.add.text(400, 160, 'Jumpy Friend', {
            fontSize: '84px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#4CAF50',
            stroke: '#2d5a27',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(400, 300, 'HOLD to charge\nRELEASE to jump!', {
            fontSize: '40px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);

        const difficulties = [
            { name: 'Easy', y: 760, color: 0x4CAF50 },
            { name: 'Medium', y: 880, color: 0xFF9800 },
            { name: 'Hard', y: 1000, color: 0xF44336 }
        ];

        difficulties.forEach(diff => {
            const btn = this.add.graphics();
            btn.fillStyle(diff.color, 1);
            btn.fillRoundedRect(200, diff.y - 44, 400, 88, 24);

            this.add.text(400, diff.y, diff.name, {
                fontSize: '48px',
                fontFamily: 'Arial Black, sans-serif',
                fill: '#fff'
            }).setOrigin(0.5);

            const zone = this.add.zone(400, diff.y, 400, 88).setInteractive();
            zone.on('pointerdown', () => {
                this.scene.start('GameScene', { difficulty: diff.name.toLowerCase() });
            });
        });

        const best = localStorage.getItem('jumpyfriend_highscore') || '0';
        this.add.text(400, 1120, `Best: ${best}`, {
            fontSize: '36px',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Bounce animation for menu character
        this.tweens.add({
            targets: this.menuChar,
            y: -40,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    drawCharacter(x, y, scale) {
        const size = 50 * scale;
        const g = this.add.graphics();
        
        // Green square body
        g.fillStyle(0x4CAF50, 1);
        g.fillRoundedRect(x - size/2, y - size/2, size, size, 8 * scale);
        
        // Black outline
        g.lineStyle(3 * scale, 0x2E7D32, 1);
        g.strokeRoundedRect(x - size/2, y - size/2, size, size, 8 * scale);
        
        // Eyes (black dots)
        g.fillStyle(0x000000, 1);
        g.fillCircle(x - size * 0.2, y - size * 0.1, 4 * scale);
        g.fillCircle(x + size * 0.2, y - size * 0.1, 4 * scale);
        
        // Smile (black arc)
        g.lineStyle(3 * scale, 0x000000, 1);
        g.beginPath();
        g.arc(x, y + size * 0.05, size * 0.25, 0.2, Math.PI - 0.2, false);
        g.strokePath();
        
        this.menuChar = g;
        g.setPosition(0, 0);
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.difficulty = data.difficulty || 'easy';
    }

    create() {
        // Background
        this.bg = this.add.graphics();
        this.drawBackground();

        // State
        this.score = 0;
        this.maxHeight = 1200;
        this.gameOver = false;
        this.jumpCount = 0;
        
        // CHARGING STATE
        this.isCharging = false;
        this.chargeStartTime = 0;
        
        // AIR JUMP STATE - only 1 air jump allowed per platform touch
        this.airJumpsUsed = 0;
        this.maxAirJumps = 1;
        this.wasOnGround = true;

        // Settings per difficulty (2x scaled)
        const settings = {
            easy: { gap: 200, width: 220, moving: 0.1, speed: 180 },
            medium: { gap: 240, width: 180, moving: 0.25, speed: 220 },
            hard: { gap: 280, width: 140, moving: 0.4, speed: 260 }
        };
        this.settings = settings[this.difficulty];

        // Platforms
        this.platforms = this.physics.add.group({
            allowGravity: false,
            immovable: true
        });

        // Ground
        this.createPlatform(400, 1120, 400);

        // Initial platforms
        let y = 920;
        for (let i = 0; i < 10; i++) {
            y -= Phaser.Math.Between(this.settings.gap - 40, this.settings.gap + 40);
            this.createPlatform(
                Phaser.Math.Between(160, 640),
                y,
                this.settings.width,
                Math.random() < this.settings.moving
            );
        }
        this.topPlatformY = y;

        // Create character sprite (green square with smiley)
        this.createPlayerSprite();
        
        // Player physics body
        this.player = this.physics.add.sprite(400, 1000, 'player');
        this.player.setDisplaySize(100, 100);
        this.player.body.setSize(100, 100);
        this.player.setCollideWorldBounds(false);
        this.player.setBounce(0);
        this.player.setVelocityX(this.settings.speed);

        // ONE-WAY PLATFORM COLLISION - reset air jumps on landing
        this.physics.add.collider(this.player, this.platforms, (player, platform) => {
            // Landed on platform - reset air jumps and rotation
            this.airJumpsUsed = 0;
            this.player.setAngularVelocity(0);
            this.player.setRotation(0);
        }, (player, platform) => {
            return player.body.velocity.y > 0 && player.body.bottom <= platform.body.top + 10;
        }, this);

        // ========== INPUT ==========
        this.input.on('pointerdown', () => this.onPointerDown());
        this.input.on('pointerup', () => this.onPointerUp());

        // ========== UI ==========
        this.scoreText = this.add.text(400, 60, '0', {
            fontSize: '96px',
            fontFamily: 'Arial Black',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 10
        }).setOrigin(0.5).setScrollFactor(0);

        // Charge meter background
        this.meterBg = this.add.graphics().setScrollFactor(0);
        this.meterBg.fillStyle(0x000000, 0.6);
        this.meterBg.fillRoundedRect(100, 1040, 600, 100, 50);

        // Charge meter fill
        this.meterFill = this.add.graphics().setScrollFactor(0);

        // Charge text
        this.chargeLabel = this.add.text(400, 1090, 'HOLD TO CHARGE', {
            fontSize: '36px',
            fontFamily: 'Arial Black',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        // Camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 160);
        this.cameras.main.setBounds(0, -99999, 800, 999999);
    }

    createPlayerSprite() {
        // Create a canvas texture for the player (2x resolution)
        const size = 100;
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Green square body with rounded corners
        graphics.fillStyle(0x4CAF50, 1);
        graphics.fillRoundedRect(0, 0, size, size, 16);
        
        // Darker green outline
        graphics.lineStyle(6, 0x2E7D32, 1);
        graphics.strokeRoundedRect(0, 0, size, size, 16);
        
        // Eyes (black dots)
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(size * 0.3, size * 0.4, 8);
        graphics.fillCircle(size * 0.7, size * 0.4, 8);
        
        // Smile (black arc)
        graphics.lineStyle(6, 0x000000, 1);
        graphics.beginPath();
        graphics.arc(size * 0.5, size * 0.55, size * 0.25, 0.2, Math.PI - 0.2, false);
        graphics.strokePath();
        
        graphics.generateTexture('player', size, size);
        graphics.destroy();
    }

    createPlatform(x, y, width, moving = false) {
        const g = this.make.graphics();
        g.fillStyle(0x8B4513);
        g.fillRoundedRect(0, 20, width, 28, 8);
        g.fillStyle(0x228B22);
        g.fillRoundedRect(0, 0, width, 28, 12);
        g.fillStyle(0x32CD32);
        g.fillRoundedRect(8, 4, width - 16, 12, 6);

        const key = `plat_${width}`;
        if (!this.textures.exists(key)) {
            g.generateTexture(key, width, 48);
        }
        g.destroy();

        const p = this.platforms.create(x, y, key);
        p.body.setSize(width, 20);
        p.body.setOffset(0, 14);
        p.body.checkCollision.down = false;
        p.body.checkCollision.left = false;
        p.body.checkCollision.right = false;
        
        if (moving) {
            p.setVelocityX(Phaser.Math.Between(100, 200) * (Math.random() > 0.5 ? 1 : -1));
            p.setData('left', x - 120);
            p.setData('right', x + 120);
            p.setData('moving', true);
        }
    }

    onPointerDown() {
        if (this.gameOver) return;
        
        // CAN ALWAYS CHARGE - no ground check!
        this.isCharging = true;
        this.chargeStartTime = this.time.now;
        this.chargeLabel.setText('CHARGING...');
        
        // Visual squish while holding
        this.tweens.killTweensOf(this.player);
        this.tweens.add({
            targets: this.player,
            scaleY: 0.7,
            scaleX: 1.3,
            duration: 100
        });
    }

    onPointerUp() {
        if (this.gameOver) return;
        if (!this.isCharging) return;
        
        // Calculate charge power (0 to 1 over 1 second)
        const chargeTime = (this.time.now - this.chargeStartTime) / 1000;
        const power = Math.min(chargeTime, 1);
        
        this.isCharging = false;
        
        // Check if we can jump
        const onGround = this.player.body.touching.down || this.player.body.blocked.down;
        
        if (!onGround) {
            // In the air - check if we have air jumps left
            if (this.airJumpsUsed >= this.maxAirJumps) {
                // No air jumps left - cancel the jump
                this.meterFill.clear();
                this.chargeLabel.setText('NO AIR JUMP!');
                this.time.delayedCall(500, () => {
                    if (!this.isCharging) this.chargeLabel.setText('HOLD TO CHARGE');
                });
                
                // Reset scale
                this.tweens.killTweensOf(this.player);
                this.tweens.add({
                    targets: this.player,
                    scaleY: 1,
                    scaleX: 1,
                    duration: 100
                });
                return;
            }
            // Use an air jump
            this.airJumpsUsed++;
        }
        
        // JUMP! (2x velocity for 2x resolution)
        const velocity = -1200 - (power * 1200); // -1200 to -2400!
        this.player.setVelocityY(velocity);
        this.jumpCount++;
        
        // SPIN when jumping! Spin speed based on power
        const spinSpeed = 300 + (power * 400); // 300 to 700 degrees per second
        const spinDirection = this.player.body.velocity.x > 0 ? 1 : -1;
        this.player.setAngularVelocity(spinSpeed * spinDirection);
        
        // Reset visuals
        this.meterFill.clear();
        this.chargeLabel.setText('HOLD TO CHARGE');
        
        this.tweens.killTweensOf(this.player);
        this.tweens.add({
            targets: this.player,
            scaleY: 1,
            scaleX: 1,
            duration: 100
        });
    }

    update() {
        if (this.gameOver) return;

        // Update charge meter while charging
        if (this.isCharging) {
            const chargeTime = (this.time.now - this.chargeStartTime) / 1000;
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
            this.meterFill.fillRoundedRect(110, 1050, 580 * power, 80, 40);

            if (power >= 1) {
                this.chargeLabel.setText('MAX POWER!');
            } else {
                this.chargeLabel.setText(`CHARGING ${pct}%`);
            }
        }

        // Wall bounce (2x values)
        if (this.player.x < 50) {
            this.player.x = 50;
            this.player.setVelocityX(Math.abs(this.player.body.velocity.x));
        } else if (this.player.x > 750) {
            this.player.x = 750;
            this.player.setVelocityX(-Math.abs(this.player.body.velocity.x));
        }

        // Moving platforms bounce
        this.platforms.children.iterate(p => {
            if (!p || !p.getData('moving')) return;
            if (p.x <= p.getData('left') || p.x >= p.getData('right')) {
                p.setVelocityX(-p.body.velocity.x);
            }
        });

        // Generate platforms above (2x values)
        while (this.topPlatformY > this.cameras.main.scrollY - 400) {
            this.topPlatformY -= Phaser.Math.Between(this.settings.gap - 40, this.settings.gap + 40);
            this.createPlatform(
                Phaser.Math.Between(160, 640),
                this.topPlatformY,
                this.settings.width,
                Math.random() < this.settings.moving
            );
        }

        // Remove platforms below
        const bottomY = this.cameras.main.scrollY + 1400;
        this.platforms.children.iterate(p => { if (p && p.y > bottomY) p.destroy(); });

        // Score
        if (this.player.y < this.maxHeight) {
            this.maxHeight = this.player.y;
            this.score = Math.floor((1200 - this.maxHeight) / 20);
            this.scoreText.setText(this.score);
        }

        // Background
        this.drawBackground();

        // Death (2x values)
        if (this.player.y > this.cameras.main.scrollY + 1300) {
            this.endGame();
        }
    }

    drawBackground() {
        const h = Math.abs(this.cameras.main.scrollY);
        let top = 0x87CEEB, bot = 0xADD8E6;
        if (h > 4000) { top = 0x5DADE2; bot = 0x87CEEB; }
        if (h > 10000) { top = 0x3498DB; bot = 0x5DADE2; }
        if (h > 20000) { top = 0x1A5276; bot = 0x3498DB; }

        this.bg.clear();
        this.bg.fillGradientStyle(top, top, bot, bot, 1);
        this.bg.fillRect(0, this.cameras.main.scrollY - 100, 800, 1400);
        this.bg.setDepth(-1);
    }

    endGame() {
        if (this.gameOver) return;
        this.gameOver = true;

        const best = parseInt(localStorage.getItem('jumpyfriend_highscore') || '0');
        if (this.score > best) {
            localStorage.setItem('jumpyfriend_highscore', this.score);
        }

        const ov = this.add.graphics().setScrollFactor(0);
        ov.fillStyle(0x000000, 0.8);
        ov.fillRect(0, 0, 800, 1200);

        this.add.text(400, 300, 'GAME OVER', {
            fontSize: '96px',
            fontFamily: 'Arial Black',
            fill: '#F44336'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(400, 460, `Score: ${this.score}`, {
            fontSize: '72px',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(400, 560, `Jumps: ${this.jumpCount}`, {
            fontSize: '40px',
            fill: '#aaa'
        }).setOrigin(0.5).setScrollFactor(0);

        if (this.score >= best && this.score > 0) {
            this.add.text(400, 660, '🏆 NEW BEST! 🏆', {
                fontSize: '56px',
                fill: '#FFD700'
            }).setOrigin(0.5).setScrollFactor(0);
        }

        this.createButton(400, 840, 'Play Again', 0x4CAF50, () => {
            this.scene.restart({ difficulty: this.difficulty });
        });

        this.createButton(400, 1000, 'Menu', 0x607D8B, () => {
            this.scene.start('MenuScene');
        });
    }

    createButton(x, y, text, color, callback) {
        const g = this.add.graphics().setScrollFactor(0);
        g.fillStyle(color, 1);
        g.fillRoundedRect(x - 200, y - 50, 400, 100, 24);

        this.add.text(x, y, text, {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const zone = this.add.zone(x, y, 400, 100).setInteractive().setScrollFactor(0);
        zone.on('pointerdown', callback);
    }
}

// Render at 2x resolution for crisp display on all devices
const GAME_WIDTH = 800;
const GAME_HEIGHT = 1200;

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#87CEEB',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1600 }, debug: false }  // 2x gravity
    },
    render: {
        antialias: true,
        pixelArt: false
    },
    scene: [MenuScene, GameScene]
};

new Phaser.Game(config);
