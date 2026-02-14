
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* =========================================
   STATE & CONFIG
   ========================================= */
const CONFIG = {
    modelUrl: './scene.gltf',
    candleUrl: './candle.gltf',
    flameColor: 0xffaa00,
    flameScale: 1.0,
    micThreshold: 20, // Volume threshold to trigger blowing
    blowSensitivity: 0.05, // How fast flame shrinks
    pinkBalloonUrl: './pinkBalloon.gltf',
};

let state = {
    isLit: true,
    candlesExtinguished: 0,
    totalCandles: 8,
    isMicActive: false,
    audioContext: null,
    analyser: null,
    dataArray: null,
    balloons: [],
};

/* =========================================
   THREE.JS SETUP
   ========================================= */
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 100);
camera.position.set(0, 0.8, 1.5);

// Renderer
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
canvasContainer.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 2.0;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(2, 5, 2);
scene.add(dirLight);

/* =========================================
   CAKE & CANDLES
   ========================================= */
const candles = []; // Stores { mesh, flameMesh, light, isOut }

const loader = new GLTFLoader();
const balloonModels = { pink: null };

// Preload Balloons
loader.load(CONFIG.pinkBalloonUrl, (gltf) => { balloonModels.pink = gltf.scene; });

loader.load(CONFIG.modelUrl, (gltf) => {
    const model = gltf.scene;

    // 1. Compute bounding box of the entire model
    const box = new THREE.Box3().setFromObject(model);
    const sizeVec = box.getSize(new THREE.Vector3());
    const modelSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z); // longest dimension

    // 2. Center the model at origin
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);           // shift so center is at (0,0,0)

    // 3. Scale to desired visible size
    const desiredSize = 50;              // adjusted to fit generic view
    const scaleFactor = desiredSize / modelSize;
    model.scale.setScalar(scaleFactor);

    // Calc top of cake for placement
    const scaledBox = new THREE.Box3().setFromObject(model);
    const cakeTopY = scaledBox.max.y;
    // Radius for candles (approx 60% of width)
    const cakeRadius = (scaledBox.max.x - scaledBox.min.x) * 0.25;

    scene.add(model);

    // 4. Adjust camera & controls
    const distance = desiredSize * 1;
    camera.position.set(0, distance * 0.5, distance);
    controls.target.set(0, 0, 0);
    controls.update();

    controls.minDistance = desiredSize * 1.0;
    controls.maxDistance = desiredSize * 5;

    // Add candles
    addCandles(cakeTopY - 3.5, cakeRadius, desiredSize);

}, undefined, (error) => {
    console.error('Model load error:', error);
});

function addCandles(baseY, radius, referenceSize) {
    loader.load(CONFIG.candleUrl, (gltf) => {
        const candleModel = gltf.scene;

        // Scale candle relative to cake
        const candleBox = new THREE.Box3().setFromObject(candleModel);
        const candleSize = candleBox.getSize(new THREE.Vector3());

        // Desired candle height approx 1/5th of cake size? or fixed?
        // Let's target a height
        const targetHeight = referenceSize * 0.25;
        const scale = targetHeight / candleSize.y;

        // Pre-scale/center the prototype candle
        candleModel.scale.setScalar(scale);

        // --- Realistic Flame Geometry (Smooth Teardrop) ---
        // Profile for a flame shape
        const flamePoints = [];
        flamePoints.push(new THREE.Vector2(0, 0)); // Bottom center
        flamePoints.push(new THREE.Vector2(0.05, 0.1)); // Base width
        flamePoints.push(new THREE.Vector2(0.12, 0.4)); // Belly
        flamePoints.push(new THREE.Vector2(0.0, 1.0)); // Tip

        const flameGeometry = new THREE.LatheGeometry(flamePoints, 32);
        const flameSizeMultiplier = 5;

        flameGeometry.scale(flameSizeMultiplier, flameSizeMultiplier, flameSizeMultiplier);

        // Pivot correction (center base)
        flameGeometry.translate(0, targetHeight * 0.05, 0);

        const flameMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa33, // Warm Orange-Gold like reference
        });

        // Distribute in circle
        const angleStep = (Math.PI * 2) / state.totalCandles;

        for (let i = 0; i < state.totalCandles; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // 1. Candle Model
            const candleInstance = candleModel.clone();
            candleInstance.position.set(x, baseY, z);
            scene.add(candleInstance);

            // 2. Flame Group
            const currentCandleHeight = targetHeight;
            const flameY = baseY + currentCandleHeight * 0.9;

            // Group for animation
            const flameGroup = new THREE.Group();
            flameGroup.position.set(x, flameY, z);

            const flameMesh = new THREE.Mesh(flameGeometry, flameMaterial);
            flameGroup.add(flameMesh);
            scene.add(flameGroup);

            // 3. Light
            const light = new THREE.PointLight(0xffaa33, 1, referenceSize * 0.8);
            light.position.set(x, flameY + 0.1, z);
            scene.add(light);

            candles.push({
                id: i,
                flameGroup: flameGroup,
                flameMesh: flameMesh, // Keep ref for direct access if needed
                light: light,
                baseScale: 1.0,
                currentScale: 1.0,
                isOut: false,
                offset: Math.random() * 100
            });
        }

        // Hide loading
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.remove(), 1000);
        }

    }, undefined, (err) => {
        console.error("Candle load error:", err);
        // Fallback: Just squares if model fails?
    });
}

// Raycaster for clicking candles
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    if (state.candlesExtinguished >= state.totalCandles) return;

    // Normalize mouse coords
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check intersection with flames
    const flameMeshes = candles.filter(c => !c.isOut).map(c => c.flameMesh);
    const intersects = raycaster.intersectObjects(flameMeshes);

    if (intersects.length > 0) {
        // Find which candle belongs to this mesh
        const hitFlame = intersects[0].object;
        const candle = candles.find(c => c.flameMesh === hitFlame);
        if (candle) {
            extinguishCandle(candle);
        }
    }
});


/* =========================================
   AUDIO & BLOW DETECTION
   ========================================= */
const startMicBtn = document.getElementById('start-mic-btn');
const instructionText = document.getElementById('instruction-text');

startMicBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        const source = state.audioContext.createMediaStreamSource(stream);
        source.connect(state.analyser);

        state.analyser.fftSize = 256;
        const bufferLength = state.analyser.frequencyBinCount;
        state.dataArray = new Uint8Array(bufferLength);

        state.isMicActive = true;
        startMicBtn.classList.add('hidden'); // Hide button
        instructionText.classList.remove('hidden'); // Show instructions

    } catch (err) {
        console.error('Mic access denied:', err);
        alert("Couldn't access microphone 😢. You can still tap the candles to blow them out!");
    }
});

function getAverageVolume() {
    if (!state.isMicActive) return 0;
    state.analyser.getByteFrequencyData(state.dataArray);
    let values = 0;
    const length = state.dataArray.length;
    for (let i = 0; i < length; i++) {
        values += state.dataArray[i];
    }
    return values / length;
}


/* =========================================
   ANIMATION & LOGIC LOOP
   ========================================= */

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // 1. Flame Flicker Animation
    const time = Date.now() * 0.005;
    candles.forEach(c => {
        if (c.isOut) return;

        // Random flicker
        const flicker = 0.8 + Math.random() * 0.4;
        c.light.intensity = flicker;
        // Scale jitter (Y-axis stretch)
        const scaleJitter = 1.0 + Math.sin(time * 10 + c.offset) * 0.1;
        c.flameGroup.scale.set(c.currentScale, c.currentScale * scaleJitter, c.currentScale);
    });

    // 2. Blow Detection Logic
    if (state.isMicActive && state.candlesExtinguished < state.totalCandles) {
        const volume = getAverageVolume();

        if (volume > CONFIG.micThreshold) {
            // Blowing detected! Reduce scale of ALL candles
            candles.forEach(c => {
                if (!c.isOut) {
                    c.currentScale -= CONFIG.blowSensitivity;
                    c.flameGroup.scale.setScalar(c.currentScale);

                    if (c.currentScale <= 0.1) {
                        extinguishCandle(c);
                    }
                }
            });
        }
    }

    // 3. Balloon Animation (Overlay)
    if (state.balloons.length > 0) {
        state.balloons.forEach((b, index) => {
            b.mesh.position.y += b.speed;
            b.mesh.position.x += Math.sin(time + b.swayOffset) * 0.005;
            b.mesh.rotation.y += 0.01;
            b.mesh.rotation.z = Math.sin(time * 2 + b.swayOffset) * 0.1;

            // Remove if out of view (top of screen)
            // Frustum check or simple Y check. 
            // In screen coords, top is +Y. Camera is at z=5 looking at 0,0,0.
            // Approx Y limit > 5 (depending on FOV and aspect)
            if (b.mesh.position.y > 8) {
                balloonScene.remove(b.mesh);
                state.balloons.splice(index, 1);
            }
        });
        balloonRenderer.render(balloonScene, balloonCamera);
    }

    renderer.render(scene, camera);
}
animate();

/* =========================================
   BALLOON OVERLAY SETUP
   ========================================= */
const balloonContainer = document.getElementById('balloon-overlay');
const balloonScene = new THREE.Scene();
const balloonCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
balloonCamera.position.set(0, 0, 5); // Standard view

const balloonRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
balloonRenderer.setSize(window.innerWidth, window.innerHeight);
balloonContainer.appendChild(balloonRenderer.domElement);

// Lighting for balloons
const balloonAmbient = new THREE.AmbientLight(0xffffff, 1.5);
balloonScene.add(balloonAmbient);
const balloonDir = new THREE.DirectionalLight(0xffffff, 2);
balloonDir.position.set(2, 5, 2);
balloonScene.add(balloonDir);


function extinguishCandle(candle) {
    if (candle.isOut) return;

    candle.isOut = true;
    candle.currentScale = 0;
    candle.flameGroup.visible = false;
    candle.light.intensity = 0;

    state.candlesExtinguished++;

    checkWinCondition();
}

function checkWinCondition() {
    if (state.candlesExtinguished >= state.totalCandles) {
        triggerCelebration();
    }
}


// Initialize on load
// Initialize on load
// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Basic initialization
    console.log("Birthday celebration initialized! 🎂");

    // Force scroll to top on refresh
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    renderChatBubbles();
    playBackgroundMusic();

    // Remove loading screen after a short delay to ensure assets are ready
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.remove(), 1000);
        }, 1000); // Wait 1s then fade out
    }
});

function renderChatBubbles() {
    const container = document.getElementById('wishes-container');
    const noMsg = document.getElementById('no-wishes-msg');

    if (!container) return; // Not on Ria page or element missing

    const wishes = JSON.parse(localStorage.getItem('Ria_wishes') || '[]');

    if (wishes.length === 0) {
        if (noMsg) noMsg.classList.remove('hidden');
        return;
    }

    const colors = [
        'bg-pink-100 text-pink-800 border-pink-200',
        'bg-purple-100 text-purple-800 border-purple-200',
        'bg-blue-100 text-blue-800 border-blue-200',
        'bg-yellow-100 text-yellow-800 border-yellow-200'
    ];

    container.innerHTML = ''; // Clear container logic

    wishes.forEach(wishData => {
        const bubble = document.createElement('div');
        // Random style choice
        const colorClass = colors[Math.floor(Math.random() * colors.length)];
        const rot = Math.random() * 6 - 3; // Slight tilt

        bubble.className = `max-w-xs p-5 rounded-2xl shadow-lg border ${colorClass} transform transition-transform hover:scale-105 flex flex-col gap-2`;
        bubble.style.transform = `rotate(${rot}deg)`;

        // Handle both old string format and new object format
        let message = '';
        let sender = 'Anonymous';

        if (typeof wishData === 'string') {
            message = wishData;
        } else {
            message = wishData.message || '';
            sender = wishData.name || 'Anonymous';
        }

        // Chat bubble tail logic (simple CSS shape or just rounded corners)
        bubble.innerHTML = `
            <p class="font-['Outfit'] text-lg leading-relaxed text-slate-700">"${message}"</p>
            <p class="text-right text-sm font-bold opacity-75 text-slate-600">- ${sender}</p>
        `;

        container.appendChild(bubble);
    });
}

function playBackgroundMusic() {
    const audio = document.getElementById('bg-music');
    if (!audio) return;

    audio.volume = 0.5; // Set a nice background volume

    // Try auto-play
    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log("Auto-play blocked. Waiting for interaction.");
            // Add one-time click listener to start music
            const startAudio = () => {
                audio.play();
                document.removeEventListener('click', startAudio);
                document.removeEventListener('touchstart', startAudio);
            };
            document.addEventListener('click', startAudio);
            document.addEventListener('touchstart', startAudio);
        });
    }
}

/* =========================================
   CELEBRATION
   ========================================= */
function triggerCelebration() {
    // 1. Stop Mic
    if (state.audioContext) {
        state.audioContext.close();
        state.isMicActive = false;
    }
    instructionText.textContent = "Yay! Happy Birthday! 🎉";

    // 2. Confetti
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ec4899', '#8b5cf6', '#fbbf24']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ec4899', '#8b5cf6', '#fbbf24']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());

    // Audio
    const audio = document.getElementById('bg-music');
    audio.play().catch(e => console.log("Audio play failed (user interaction needed first?)", e));

    // 3. Reveal Content
    setTimeout(() => {
        const content = document.getElementById('celebration-content');
        content.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.add('pointer-events-auto');

        // Scroll to gallery
        document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    }, 1500);

    // 4. Start Balloon Flow
    startBalloonFlow();

    // 5. Reveal Numbers & Navbar
    const numbers = document.getElementById('number-vectors');
    if (numbers) {
        numbers.classList.remove('opacity-0');
        numbers.classList.remove('translate-y-8'); // Slide up effect
    }

    const nav = document.getElementById('main-nav');
    if (nav) {
        nav.classList.remove('opacity-0');
        nav.classList.remove('pointer-events-none');
    }

    // Hide Interaction Controls
    const controls = document.getElementById('interaction-controls');
    if (controls) {
        controls.classList.add('opacity-0', 'pointer-events-none');
    }

    // 6. Enable Scroll
    document.body.classList.remove('overflow-y-hidden');
}

function startBalloonFlow() {
    // Spawn balloons continuously for a while
    const interval = setInterval(() => {
        spawnBalloon();
    }, 200);

    // Stop spawning after 15 seconds
    setTimeout(() => clearInterval(interval), 15000);
}

function spawnBalloon() {
    if (!balloonModels.pink) return;

    const model = balloonModels.pink;
    const balloon = model.clone();

    // Viewport-based spawn position (your existing code)
    const aspect = window.innerWidth / window.innerHeight;
    const visibleHeight = 2 * Math.tan((balloonCamera.fov * Math.PI / 180) / 2) * balloonCamera.position.z;
    const visibleWidth = visibleHeight * aspect;

    const x = (Math.random() - 0.5) * visibleWidth;
    const y = -visibleHeight / 2 - 1;
    const z = (Math.random() - 0.5) * 2;

    balloon.position.set(x, y, z);

    // Scale logic
    const scale = 0.5 + Math.random() * 0.5;
    balloon.scale.setScalar(scale);

    balloonScene.add(balloon);

    state.balloons.push({
        mesh: balloon,
        speed: 0.02 + Math.random() * 0.03,
        swayOffset: Math.random() * 100
    });
}


/* =========================================
   GALLERY DATA
   ========================================= */
const memories = [
    { img: './assets/HerInSaree.jpeg', msg: "Remember when you laughed so hard at my terrible joke? That's when I knew ❤️" },
    { img: './assets/Smiling.jpeg', msg: "You make every ordinary day feel like a celebration." },
    { img: './assets/ME&Her.jpeg', msg: "To the girl who stole my heart... and my fries 🍟" },
    { img: './assets/Selfie.jpeg', msg: "Your smile is literally the best thing in the world." },
    { img: './assets/Graduation.jpeg', msg: "So proud of everything you've achieved! 🎓" },
    { img: './assets/Outing.jpeg', msg: "Can't wait for a million more adventures with you." },
    { img: './assets/Flauting.jpeg', msg: "I love you more than code loves semicolons ;)" },
    { img: './assets/Sisters.jpeg', msg: "Today is all about you, my Queen 👑" },
    { img: './assets/herMomSister.jpeg', msg: "Here's to growing old and happy together 🥂" },
    { img: './assets/Family.jpeg', msg: "Ria, you are magic ✨" },
];

const photoGrid = document.getElementById('photo-grid');

memories.forEach((mem, i) => {
    const rot = Math.random() * 6 - 3; // Random rotation between -3 and 3
    const card = document.createElement('div');
    card.className = `polaroid transform hover: scale - 105 transition - all duration - 300 cursor - pointer`;
    card.style.transform = `rotate(${rot}deg)`;

    card.innerHTML = `
        <img src="${mem.img}" class="polaroid-img" alt="Memory">
        <div class="polaroid-overlay">
            <p class="text-pink-600 font-bold font-['Inter']">${mem.msg}</p>
        </div>
    `;

    photoGrid.appendChild(card);
});




// Window resize handling
window.addEventListener('resize', () => {
    camera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);

    // Resize balloon overlay
    balloonCamera.aspect = window.innerWidth / window.innerHeight;
    balloonCamera.updateProjectionMatrix();
    balloonRenderer.setSize(window.innerWidth, window.innerHeight);
});
