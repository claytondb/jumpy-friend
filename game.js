// Jumpy Friend - Hold-to-Jump Platformer
// A charming infinite climbing game with charge-and-release mechanics

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        // Load character for menu display
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
        this.add.text(200, 160, 'Hold to charge, release to jump!', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Difficulty buttons
        const difficulties = [
            { name: 'Easy', y: 380, color: '#4CAF50' },
            { name: 'Medium', y: 440, color: '#FF9800' },
            { name: 'Hard', y: 500, color: '#F44336' }
        ];

        difficulties.forEach(diff => {
            // Button background
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

            // Interactive zone
            const zone = this.add.zone(200, diff.y, 200, 45).setInteractive();
            zone.on('pointerover', () => {
                btn.clear();
                btn.fillStyle(Phaser.Display.Color.HexStringToColor(diff.color).lighten(20).color, 1);
                btn.fillRoundedRect(100, diff.y - 20, 200, 45, 12);
                btn.lineStyle(3, 0xffffff, 1);
                btn.strokeRoundedRect(100, diff.y - 20, 200, 45, 12);
            });
            zone.on('pointerout', () => {
                btn.clear();
                btn.fillStyle(Phaser.Display.Color.HexStringToColor(diff.color).color, 1);
                btn.fillRoundedRect(100, diff.y - 20, 200, 45, 12);
                btn.lineStyle(3, 0xffffff, 0.8);
                btn.strokeRoundedRect(100, diff.y - 20, 200, 45, 12);
            });
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
        // Load character sprite
        this.load.image('character', 'assets/character.png');
    }

    create() {
        // Fade in
        this.cameras.main.fadeIn(300);

        // Sky gradient background (recreated each frame with camera)
        this.bgGraphics = this.add.graphics();
        this.updateBackground();

        // Game state
        this.score = 0;
        this.maxHeight = 600;
        this.isCharging = false;
        this.chargeTime = 0;
        this.gameOver = false;
        this.jumpCount = 0;

        // Difficulty settings
        this.settings = {
            easy: { gapMin: 80, gapMax: 100, platformWidth: 100, moveChance: 0.15, speed: 120 },
            medium: { gapMin: 90, gapMax: 120, platformWidth: 80, moveChance: 0.3, speed: 140 },
            hard: { gapMin: 100, gapMax: 140, platformWidth: 60, moveChance: 0.5, speed: 160 }
        }[this.difficulty];

        // Platform groups
        this.platforms = this.physics.add.staticGroup();
        this.movingPlatforms = this.physics.add.group({
            immovable: true,
            allowGravity: false
        });

        // Create initial ground platform
        this.createPlatform(200, 550, 150, false);

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
        this.character.body.setSize(48, 64);
        this.character.body.setOffset(40, 64);
        this.character.setVelocityX(this.settings.speed);

        // Collisions
        this.physics.add.collider(this.character, this.platforms, this.onLand, null, this);
        this.physics.add.collider(this.character, this.movingPlatforms, this.onLand, null, this);

        // Input
        this.input.on('pointerdown', this.startCharging, this);
        this.input.on('pointerup', this.releaseJump, this);
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // UI Layer (fixed to camera)
        this.uiLayer = this.add.container(0, 0).setScrollFactor(0);

        // Score display
        this.scoreText = this.add.text(200, 25, '0', {
            fontSize: '36px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff',
            stroke: '#333',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        // Jump meter background
        this.meterBg = this.add.graphics().setScrollFactor(0);
        this.meterBg.fillStyle(0x333333, 0.5);
        this.meterBg.fillRoundedRect(20, 560, 100, 20, 5);

        // Jump meter fill
        this.meterFill = this.add.graphics().setScrollFactor(0);

        // Charge indicator text
        this.chargeText = this.add.text(70, 545, 'HOLD TO CHARGE', {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0).setAlpha(0.7);

        // Camera follow
        this.cameras.main.startFollow(this.character, true, 0.1, 0.1, 0, 100);
        this.cameras.main.setBounds(0, -Infinity, 400, Infinity);

        // Particles for landing effect
        this.landParticles = this.add.particles(0, 0, {
            speed: { min: 50, max: 100 },
            angle: { min: 230, max: 310 },
            scale: { start: 0.4, end: 0 },
            lifespan: 400,
            gravityY: 200,
            tint: 0x8B4513,
            emitting: false
        });
    }

    createPlatform(x, y, width, isMoving) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Platform style - grassy top
        graphics.fillStyle(0x8B4513); // Brown base
        graphics.fillRoundedRect(0, 8, width, 16, 4);
        graphics.fillStyle(0x228B22); // Green grass top
        graphics.fillRoundedRect(0, 0, width, 14, 6);
        graphics.fillStyle(0x32CD32); // Light green highlight
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
            platform.setData('dir', platform.body.velocity.x > 0 ? 1 : -1);
        } else {
            const platform = this.platforms.create(x, y, key);
            platform.body.setSize(width, 16);
            platform.body.setOffset(0, 4);
            platform.refreshBody();
        }
    }

    onLand(character, platform) {
        if (character.body.touching.down) {
            // Small landing effect
            this.landParticles.setPosition(character.x, character.y + 32);
            this.landParticles.explode(5);
        }
    }

    startCharging() {
        if (this.gameOver) return;
        if (this.character.body.touching.down || this.character.body.blocked.down) {
            this.isCharging = true;
            this.chargeTime = 0;
            this.chargeText.setText('CHARGING...');
        }
    }

    releaseJump() {
        if (this.gameOver) return;
        if (this.isCharging) {
            this.isCharging = false;
            const power = Math.min(this.chargeTime, 1);
            const jumpVelocity = -350 - (power * 350); // -350 to -700
            this.character.setVelocityY(jumpVelocity);
            this.jumpCount++;
            
            // Visual feedback
            this.meterFill.clear();
            this.chargeText.setText('HOLD TO CHARGE');

            // Jump squash animation
            this.tweens.add({
                targets: this.character,
                scaleX: 0.6,
                scaleY: 0.4,
                duration: 80,
                yoyo: true
            });
        }
    }

    update(time, delta) {
        if (this.gameOver) return;

        // Update background gradient based on height
        this.updateBackground();

        // Keyboard charging
        if (this.jumpKey.isDown && !this.isCharging && (this.character.body.touching.down || this.character.body.blocked.down)) {
            this.startCharging();
        }
        if (this.jumpKey.isUp && this.isCharging) {
            this.releaseJump();
        }

        // Charge meter
        if (this.isCharging) {
            this.chargeTime += delta / 1000;
            const power = Math.min(this.chargeTime, 1);
            this.meterFill.clear();
            
            // Color gradient from green to red
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 76, g: 175, b: 80 },
                { r: 244, g: 67, b: 54 },
                100,
                power * 100
            );
            this.meterFill.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
            this.meterFill.fillRoundedRect(22, 562, 96 * power, 16, 4);
        }

        // Wall bounce
        if (this.character.x < 16) {
            this.character.x = 16;
            this.character.setVelocityX(Math.abs(this.character.body.velocity.x));
            this.character.setFlipX(false);
        }
        if (this.character.x > 384) {
            this.character.x = 384;
            this.character.setVelocityX(-Math.abs(this.character.body.velocity.x));
            this.character.setFlipX(true);
        }

        // Moving platforms logic
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

        // Game over - fell below screen
        if (this.character.y > this.cameras.main.scrollY + 650) {
            this.triggerGameOver();
        }
    }

    updateBackground() {
        const scrollY = this.cameras.main.scrollY;
        const height = Math.abs(scrollY);
        
        // Color shifts as you go higher
        let topColor, bottomColor;
        if (height < 1000) {
            topColor = 0x87CEEB; // Sky blue
            bottomColor = 0xB0E0E6;
        } else if (height < 3000) {
            topColor = 0x6BB3D9;
            bottomColor = 0x87CEEB;
        } else if (height < 6000) {
            topColor = 0x4A90B8;
            bottomColor = 0x6BB3D9;
        } else {
            topColor = 0x2C3E50; // Dark space-like
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

        // Save high score
        const currentBest = parseInt(localStorage.getItem('jumpyfriend_highscore') || '0');
        if (this.score > currentBest) {
            localStorage.setItem('jumpyfriend_highscore', this.score.toString());
        }

        // Game over display
        const overlay = this.add.graphics().setScrollFactor(0);
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 400, 600);

        this.add.text(200, 200, 'GAME OVER', {
            fontSize: '42px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#F44336',
            stroke: '#fff',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 270, `Score: ${this.score}`, {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.add.text(200, 310, `Jumps: ${this.jumpCount}`, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fill: '#aaa'
        }).setOrigin(0.5).setScrollFactor(0);

        const bestScore = localStorage.getItem('jumpyfriend_highscore');
        if (this.score >= parseInt(bestScore)) {
            this.add.text(200, 350, '🏆 NEW BEST! 🏆', {
                fontSize: '24px',
                fontFamily: 'Arial, sans-serif',
                fill: '#FFD700'
            }).setOrigin(0.5).setScrollFactor(0);
        }

        // Restart button
        const restartBtn = this.add.graphics().setScrollFactor(0);
        restartBtn.fillStyle(0x4CAF50, 1);
        restartBtn.fillRoundedRect(100, 420, 200, 50, 12);
        
        this.add.text(200, 445, 'Play Again', {
            fontSize: '24px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const restartZone = this.add.zone(200, 445, 200, 50).setInteractive().setScrollFactor(0);
        restartZone.on('pointerdown', () => {
            this.scene.restart({ difficulty: this.difficulty });
        });

        // Menu button
        const menuBtn = this.add.graphics().setScrollFactor(0);
        menuBtn.fillStyle(0x607D8B, 1);
        menuBtn.fillRoundedRect(100, 490, 200, 50, 12);
        
        this.add.text(200, 515, 'Menu', {
            fontSize: '24px',
            fontFamily: 'Arial Black, sans-serif',
            fill: '#fff'
        }).setOrigin(0.5).setScrollFactor(0);

        const menuZone = this.add.zone(200, 515, 200, 50).setInteractive().setScrollFactor(0);
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
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene]
};

// Initialize game
const game = new Phaser.Game(config);
