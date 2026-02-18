// Jumpy Friend - Hold-to-Jump Platformer
// A charming hold-to-jump infinite climber game

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        this.load.image('character', 'assets/character.png');
    }

    create() {
        // Sky gradient background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4AA8D8, 0x4AA8D8, 1);
        graphics.fillRect(0, 0, 400, 600);

        // Clouds decoration
        this.add.text(50, 50, '☁️', { fontSize: '48px' }).setAlpha(0.6);
        this.add.text(280, 80, '☁️', { fontSize: '32px' }).setAlpha(0.5);
        this.add.text(150, 120, '☁️', { fontSize: '24px' }).setAlpha(0.4);

        // Character preview (bouncing animation)
        this.character = this.add.image(200, 280, 'character').setScale(1.5);
        this.tweens.add({
            targets: this.character,
            y: 260,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Title with shadow
        this.add.text(202, 82, 'Jumpy Friend', {
            fontSize: '42px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#2d5a27'
        }).setOrigin(0.5);
        this.add.text(200, 80, 'Jumpy Friend', {
            fontSize: '42px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#4CAF50'
        }).setOrigin(0.5);

        // Instructions
        this.add.text(200, 160, 'HOLD anywhere to charge', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        this.add.text(200, 185, 'RELEASE to jump!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fill: '#FFD700',
            stroke: '#333',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Difficulty buttons
        const difficulties = [
            { name: 'Easy', y: 380, color: '#4CAF50' },
            { name: 'Medium', y: 440, color: '#FF9800' },
            { name: 'Hard', y: 500, color: '#F44336' }
        ];

        difficulties.forEach(diff => {
            const btn = this.add.graphics();
            btn.fillStyle(Phaser.Display.Color.HexStringToColor(diff.color).color, 1);
            btn.fillRoundedRect(100, diff.y - 20, 200, 45, 12);
            btn.lineStyle(3, 0xffffff, 0.8);
            btn.strokeRoundedRect(100, diff.y - 20, 200, 45, 12);

            const buttonText = this.add.text(200, diff.y, diff.name, {
                fontSize: '24px',
                fontFamily: 'Arial Black, sans-serif',
                fill: '#fff',
                stroke: '#333',
                strokeThickness: 2
            }).setOrigin(0.5);

            const zone = this.add.zone(200, diff.y, 200, 45).setInteractive();
            zone.on('pointerdown', () => {
                this.cameras.main.fade(300, 0, 0, 0);
                this.time.delayedCall(300, () => {
                    this.scene.start('GameScene', { difficulty: diff.name.toLowerCase() });
                });
            });
        });

        // High scores display
        const highScores = JSON.parse(localStorage.getItem('jumpyfriend_highscore') || '0');
        this.add.text(200, 560, `Best: ${highScores}`, {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
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
        this.cameras.main.fadeIn(300);

        // Background
        this.bgGraphics = this.add.graphics();
        this.updateBackground();

        // Game state
        this.score = 0;
        this.maxHeight = 600;
        this.isCharging = false;
        this.chargeTime = 0;
        this.gameOver = false;
        this.jumpCount = 0;
        this.isOnGround = false;

        // Difficulty settings
        this.settings = {
            easy: { gapMin: 80, gapMax: 100, platformWidth: 100, moveChance: 0.15, speed: 100 },
            medium: { gapMin: 90, gapMax: 120, platformWidth: 80, moveChance: 0.3, speed: 120 },
            hard: { gapMin: 100, gapMax: 140, platformWidth: 60, moveChance: 0.5, speed: 140 }
        }[this.difficulty];

        // Platform groups
        this.platforms = this.physics.add.staticGroup();
        this.movingPlatforms = this.physics.add.group({
            immovable: true,
            allowGravity: false
        });

        // Create initial ground platform
        this.createPlatform(200, 550, 180, false);

        // Generate initial platforms
        let y = 450;
        for (let i = 0; i < 12; i++) {
            y -= Phaser.Math.Between(this.settings.gapMin, this.settings.gapMax);
            const x = Phaser.Math.Between(60, 340);
            const isMoving = Math.random() < this.settings.moveChance;
            this.createPlatform(x, y, this.settings.platformWidth, isMoving);
        }
        this.highestPlatformY = y;

        // Character
        this.character = this.physics.add.sprite(200, 480, 'character');
        this.character.setScale(0.5);
        this.character.setBounce(0);
        this.character.setCollideWorldBounds(false);
        this.character.body.setSize(48, 60);
        this.character.body.setOffset(40, 68);
        this.character.setVelocityX(this.settings.speed);

        // Collisions
        this.physics.add.collider(this.character, this.platforms, this.onLand, null, this);
        this.physics.add.collider(this.character, this.movingPlatforms, this.onLand, null, this);

        // === MAIN INPUT: Entire screen is the jump button ===
        this.input.on('pointerdown', this.startCharging, this);
        this.input.on('pointerup', this.releaseJump, this);
        
        // Keyboard support
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // === UI LAYER (fixed to camera) ===
        
        // Score display
        this.scoreText = this.add.text(200, 30, '0', {
            fontSize: '48px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0);

        // === CHARGE METER - Big and visible at bottom ===
        this.meterBg = this.add.graphics().setScrollFactor(0);
        this.meterBg.fillStyle(0x000000, 0.5);
        this.meterBg.fillRoundedRect(50, 530, 300, 40, 20);
        this.meterBg.lineStyle(3, 0xffffff, 0.5);
        this.meterBg.strokeRoundedRect(50, 530, 300, 40, 20);

        this.meterFill = this.add.graphics().setScrollFactor(0);

        // Charge text
        this.chargeText = this.add.text(200, 550, 'HOLD ANYWHERE TO CHARGE!', {
            fontSize: '14px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);

        // Charge percentage
        this.chargePercent = this.add.text(200, 505, '', {
            fontSize: '28px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#FFD700',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setAlpha(0);

        // Camera follow
        this.cameras.main.startFollow(this.character, true, 0.1, 0.1, 0, 100);
        this.cameras.main.setBounds(0, -Infinity, 400, Infinity);
    }

    createPlatform(x, y, width, isMoving) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Platform style - grassy top
        graphics.fillStyle(0x8B4513);
        graphics.fillRoundedRect(0, 8, width, 16, 4);
        graphics.fillStyle(0x228B22);
        graphics.fillRoundedRect(0, 0, width, 14, 6);
        graphics.fillStyle(0x32CD32);
        graphics.fillRoundedRect(4, 2, width - 8, 6, 3);

        const key = `platform_${width}_${isMoving ? 'm' : 's'}`;
        if (!this.textures.exists(key)) {
            graphics.generateTexture(key, width, 24);
        }

        if (isMoving) {
            const platform = this.movingPlatforms.create(x, y, key);
            platform.body.setSize(width, 16);
            platform.body.setOffset(0, 4);
            platform.setVelocityX(Phaser.Math.Between(-80, 80) || 60);
            platform.setData('minX', x - 60);
            platform.setData('maxX', x + 60);
        } else {
            const platform = this.platforms.create(x, y, key);
            platform.body.setSize(width, 16);
            platform.body.setOffset(0, 4);
            platform.refreshBody();
        }
    }

    onLand(character, platform) {
        if (character.body.touching.down) {
            this.isOnGround = true;
        }
    }

    startCharging() {
        if (this.gameOver) return;
        
        // Can charge anytime when on ground
        this.isOnGround = this.character.body.touching.down || this.character.body.blocked.down;
        
        if (this.isOnGround) {
            this.isCharging = true;
            this.chargeTime = 0;
            this.chargeText.setText('CHARGING...');
            this.chargePercent.setAlpha(1);
            
            // Squish character while charging
            this.tweens.add({
                targets: this.character,
                scaleY: 0.35,
                scaleX: 0.6,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        }
    }

    releaseJump() {
        if (this.gameOver) return;
        
        if (this.isCharging) {
            this.isCharging = false;
            
            // Calculate jump power (0 to 1)
            const power = Math.min(this.chargeTime / 1.0, 1); // 1 second for full charge
            
            // Jump! Minimum jump + bonus from charge
            const jumpVelocity = -300 - (power * 450); // -300 to -750
            this.character.setVelocityY(jumpVelocity);
            this.jumpCount++;
            
            // Reset visuals
            this.meterFill.clear();
            this.chargeText.setText('HOLD ANYWHERE TO CHARGE!');
            this.chargePercent.setAlpha(0);

            // Stretch animation on jump
            this.tweens.add({
                targets: this.character,
                scaleY: 0.6,
                scaleX: 0.4,
                duration: 100,
                ease: 'Quad.easeOut',
                yoyo: true,
                onComplete: () => {
                    this.character.setScale(0.5);
                }
            });
        }
    }

    update(time, delta) {
        if (this.gameOver) return;

        this.updateBackground();

        // Check if on ground
        this.isOnGround = this.character.body.touching.down || this.character.body.blocked.down;

        // Keyboard charging
        if (this.spaceKey.isDown && !this.isCharging && this.isOnGround) {
            this.startCharging();
        }
        if (this.spaceKey.isUp && this.isCharging) {
            this.releaseJump();
        }

        // Update charge meter
        if (this.isCharging && this.isOnGround) {
            this.chargeTime += delta / 1000;
            const power = Math.min(this.chargeTime / 1.0, 1);
            const percent = Math.floor(power * 100);
            
            // Update meter fill with color gradient
            this.meterFill.clear();
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 76, g: 175, b: 80 },   // Green
                { r: 255, g: 215, b: 0 },    // Gold at full
                100,
                percent
            );
            this.meterFill.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
            this.meterFill.fillRoundedRect(55, 535, 290 * power, 30, 15);
            
            // Update percentage text
            this.chargePercent.setText(`${percent}%`);
            
            // Pulse effect at full charge
            if (power >= 1) {
                this.chargeText.setText('MAX POWER! RELEASE!');
                this.meterFill.lineStyle(4, 0xFFD700, 1);
                this.meterFill.strokeRoundedRect(55, 535, 290, 30, 15);
            }
        }

        // Wall bounce
        if (this.character.x < 20) {
            this.character.x = 20;
            this.character.setVelocityX(Math.abs(this.character.body.velocity.x));
            this.character.setFlipX(false);
        }
        if (this.character.x > 380) {
            this.character.x = 380;
            this.character.setVelocityX(-Math.abs(this.character.body.velocity.x));
            this.character.setFlipX(true);
        }

        // Moving platforms
        this.movingPlatforms.getChildren().forEach(platform => {
            const minX = platform.getData('minX');
            const maxX = platform.getData('maxX');
            if (platform.x <= minX) {
                platform.setVelocityX(Math.abs(platform.body.velocity.x));
            } else if (platform.x >= maxX) {
                platform.setVelocityX(-Math.abs(platform.body.velocity.x));
            }
        });

        // Generate new platforms above
        while (this.highestPlatformY > this.cameras.main.scrollY - 200) {
            this.highestPlatformY -= Phaser.Math.Between(this.settings.gapMin, this.settings.gapMax);
            const x = Phaser.Math.Between(60, 340);
            const isMoving = Math.random() < this.settings.moveChance;
            this.createPlatform(x, this.highestPlatformY, this.settings.platformWidth, isMoving);
        }

        // Remove platforms below view
        const bottomY = this.cameras.main.scrollY + 700;
        this.platforms.getChildren().forEach(p => {
            if (p.y > bottomY) p.destroy();
        });
        this.movingPlatforms.getChildren().forEach(p => {
            if (p.y > bottomY) p.destroy();
        });

        // Score based on height
        if (this.character.y < this.maxHeight) {
            this.maxHeight = this.character.y;
            this.score = Math.floor((600 - this.maxHeight) / 10);
            this.scoreText.setText(this.score.toString());
        }

        // Game over
        if (this.character.y > this.cameras.main.scrollY + 650) {
            this.triggerGameOver();
        }
    }

    updateBackground() {
        const scrollY = this.cameras.main.scrollY;
        const height = Math.abs(scrollY);
        
        let topColor, bottomColor;
        if (height < 1000) {
            topColor = 0x87CEEB;
            bottomColor = 0xB0E0E6;
        } else if (height < 3000) {
            topColor = 0x6BB3D9;
            bottomColor = 0x87CEEB;
        } else if (height < 6000) {
            topColor = 0x4A90B8;
            bottomColor = 0x6BB3D9;
        } else {
            topColor = 0x2C3E50;
            bottomColor = 0x4A90B8;
        }

        this.bgGraphics.clear();
        this.bgGraphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
        this.bgGraphics.fillRect(0, scrollY - 100, 400, 800);
        this.bgGraphics.setDepth(-1);
    }

    triggerGameOver() {
        if (this.gameOver) return;
        this.gameOver = true;

        const currentBest = parseInt(localStorage.getItem('jumpyfriend_highscore') || '0');
        if (this.score > currentBest) {
            localStorage.setItem('jumpyfriend_highscore', this.score.toString());
        }

        const overlay = this.add.graphics().setScrollFactor(0);
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 400, 600);

        this.add.text(200, 180, 'GAME OVER', {
            fontSize: '42px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#F44336',
            stroke: '#fff',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 250, `Score: ${this.score}`, {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 295, `Jumps: ${this.jumpCount}`, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fill: '#aaa'
        }).setOrigin(0.5).setScrollFactor(0);

        const bestScore = localStorage.getItem('jumpyfriend_highscore');
        if (this.score >= parseInt(bestScore)) {
            this.add.text(200, 340, '🏆 NEW BEST! 🏆', {
                fontSize: '28px',
                fontFamily: 'Arial, sans-serif',
                fill: '#FFD700'
            }).setOrigin(0.5).setScrollFactor(0);
        }

        // Restart button
        const restartBtn = this.add.graphics().setScrollFactor(0);
        restartBtn.fillStyle(0x4CAF50, 1);
        restartBtn.fillRoundedRect(100, 400, 200, 55, 12);
        
        this.add.text(200, 427, 'Play Again', {
            fontSize: '24px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const restartZone = this.add.zone(200, 427, 200, 55).setInteractive().setScrollFactor(0);
        restartZone.on('pointerdown', () => {
            this.scene.restart({ difficulty: this.difficulty });
        });

        // Menu button
        const menuBtn = this.add.graphics().setScrollFactor(0);
        menuBtn.fillStyle(0x607D8B, 1);
        menuBtn.fillRoundedRect(100, 470, 200, 55, 12);
        
        this.add.text(200, 497, 'Menu', {
            fontSize: '24px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const menuZone = this.add.zone(200, 497, 200, 55).setInteractive().setScrollFactor(0);
        menuZone.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }
}

// Game configuration
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
        arcade: {
            gravity: { y: 900 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene]
};

// Initialize game
const game = new Phaser.Game(config);
