import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useStore } from '../store/useStore';

// --- Shaders ---

const vertexShader = `
  uniform float uTime;
  uniform float uExplosion; // 0 = tree, 1 = exploded
  uniform float uAudio;     // 0 to 1 bass level
  uniform float uFocus;     // 0 = normal, 1 = focused (dim particles)
  
  attribute vec3 aScatterPos;
  attribute float aSize;
  attribute vec3 aColor;
  
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    
    // Mix between original tree position and random scatter position
    vec3 currentPos = mix(position, aScatterPos, uExplosion);
    
    // Audio pulsation (affects size)
    float beat = 1.0 + uAudio * 1.5; 
    
    // Slight idle float
    currentPos.y += sin(uTime * 0.5 + currentPos.x) * 0.1 * (1.0 - uExplosion);

    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // Size attenuation
    gl_PointSize = aSize * beat * (300.0 / -mvPosition.z);
    
    gl_Position = projectionMatrix * mvPosition;
    
    // Alpha Logic:
    // 1. Fade out slightly when exploded (uExplosion)
    // 2. Fade out significantly when focused (uFocus) to avoid obstruction
    float explosionFade = 1.0 - (uExplosion * 0.3);
    float focusFade = 1.0 - (uFocus * 0.85); // Dim by 85% when focused
    
    vAlpha = explosionFade * focusFade;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    // Circular particle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Soft edge glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);
    
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

// --- Geometry Helpers ---

const TREE_HEIGHT = 16;
const TREE_RADIUS = 5.0;

// Palettes
const CHRISTMAS_PALETTE = [
  new THREE.Color('#FFD700'), // Gold
  new THREE.Color('#FF0033'), // Red
  new THREE.Color('#00FF33'), // Green
];

const SPRING_PALETTE = [
  new THREE.Color('#FFD700'), // Gold
  new THREE.Color('#FF0000'), // Red
  new THREE.Color('#FF4400'), // Orange
];

// --- Custom Top Decorations ---

const StarTopper: React.FC = () => {
  const { shape, settings } = useMemo(() => {
    const s = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < 2 * points; i++) {
      const r = (i % 2 === 0) ? 0.9 : 0.45;
      const a = i * Math.PI / points;
      s.lineTo(r * Math.sin(a), r * Math.cos(a));
    }
    s.closePath();
    return { shape: s, settings: { depth: 0.2, bevelEnabled: true, bevelThickness: 0.1 } };
  }, []);

  return (
    <mesh>
      <extrudeGeometry args={[shape, settings]} />
      <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2.0} toneMapped={false} />
    </mesh>
  );
};

const LanternTopper: React.FC = () => {
  return (
    <group>
       <mesh position={[0,0,0]}>
         <sphereGeometry args={[0.8, 16, 16]} />
         <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={1.5} toneMapped={false} />
       </mesh>
       <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2]} />
          <meshStandardMaterial color="#333" />
       </mesh>
       <mesh position={[0, -0.9, 0]}>
           <cylinderGeometry args={[0.1, 0.0, 1.0]} />
           <meshBasicMaterial color="#FFD700" />
       </mesh>
    </group>
  );
};

// --- Photo Component (Hybrid) ---

const PhotoFrame: React.FC<{ 
    url: string; 
    position: THREE.Vector3; 
    rotation: THREE.Euler; 
    explosion: number;
    scatterPos: THREE.Vector3;
    isFocused: boolean;
    onClick: (e: any) => void;
}> = ({ url, position, rotation, explosion, scatterPos, isFocused, onClick }) => {
    const texture = useLoader(THREE.TextureLoader, url);
    const meshRef = useRef<THREE.Group>(null);
    const { camera } = useThree();
    
    // Physics / Sway Data
    const randomOffset = useMemo(() => Math.random() * 100, []);
    
    useFrame((state) => {
        if(meshRef.current) {
             const time = state.clock.getElapsedTime();
             
             // Position Mixing - Use passed scatterPos
             const currentPos = new THREE.Vector3().lerpVectors(position, scatterPos, explosion);
             meshRef.current.position.copy(currentPos);
             
             // Scale Logic: Enlarge significantly when focused (Photo Enlargement State)
             const targetScale = isFocused ? 3.0 : 1.0;
             meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
             
             // Rotation Logic
             if (isFocused) {
                 // Strictly face camera when focused
                 meshRef.current.lookAt(camera.position);
             } else if (explosion > 0.5) {
                 // Nebula / Spread Phase
                 // Face camera to be visible while "floating"
                 meshRef.current.lookAt(camera.position);
             } else {
                 // Tree Phase: Gentle wind/sway physics
                 const period = 2.0;
                 const swayAmp = 0.05; // Radians
                 const sway = Math.sin((time + randomOffset) * (Math.PI * 2 / period)) * swayAmp;

                 meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, rotation.x, 0.1);
                 meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, rotation.y + sway, 0.1);
                 meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, rotation.z + sway * 0.5, 0.1);
             }
        }
    });

    return (
        <group ref={meshRef} onClick={onClick}>
            <mesh position={[0,0,0]}>
                <boxGeometry args={[1.2, 1.5, 0.05]} />
                <meshStandardMaterial color="#eee" />
            </mesh>
            <mesh position={[0, 0.15, 0.03]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} />
            </mesh>
        </group>
    );
};


// --- MAIN TREE ---

const ChristmasTree: React.FC = () => {
    const { phase, setPhase, gestureState, theme, audioData, uploadedPhotos, handPosition, handRotation } = useStore();
    const { camera, controls } = useThree() as any; // Access controls from makeDefault
    
    // Shader Refs
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const explosionVal = useRef(0); // 0 to 1
    const focusVal = useRef(0); // 0 = normal, 1 = focused (dim particles)
    
    // Camera Animation State
    const [focusedPhotoIndex, setFocusedPhotoIndex] = useState<number | null>(null);

    // Memoize uniforms to prevent re-instantiation
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uExplosion: { value: 0 },
        uAudio: { value: 0 },
        uFocus: { value: 0 }
    }), []);

    // --- 1. Generate Particles (Memoized) ---
    const { positions, scatterPos, colors, sizes } = useMemo(() => {
        const posArray: number[] = [];
        const scatterArray: number[] = [];
        const colorArray: number[] = [];
        const sizeArray: number[] = [];

        const palette = theme === 'christmas' ? CHRISTMAS_PALETTE : SPRING_PALETTE;

        // A. Inner Tree (6000)
        for(let i=0; i<6000; i++) {
            const y = (Math.random() * TREE_HEIGHT) - (TREE_HEIGHT/2);
            const rBase = TREE_RADIUS * (1 - (y + TREE_HEIGHT/2)/TREE_HEIGHT);
            const r = rBase * Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            
            posArray.push(r * Math.cos(theta), y, r * Math.sin(theta));
            
            // Scatter to random sphere
            const dir = new THREE.Vector3().randomDirection().multiplyScalar(10 + Math.random()*20);
            scatterArray.push(dir.x, dir.y, dir.z);
            
            const col = palette[Math.floor(Math.random() * palette.length)];
            colorArray.push(col.r, col.g, col.b);
            
            sizeArray.push(Math.random() * 0.15 + 0.05);
        }

        // B. Outer Dust (2000)
        for(let i=0; i<2000; i++) {
            const dir = new THREE.Vector3().randomDirection().multiplyScalar(TREE_RADIUS * 1.5 + Math.random()*5);
            posArray.push(dir.x, dir.y, dir.z);
            scatterArray.push(dir.x * 2, dir.y * 2, dir.z * 2);
            
            colorArray.push(0.8, 0.8, 1.0); // Silver/Blueish
            sizeArray.push(Math.random() * 0.1);
        }

        // C. Spiral Ribbon (1500)
        const spiralLoops = 8;
        for(let i=0; i<1500; i++) {
            const t = i/1500;
            const y = (t * TREE_HEIGHT) - (TREE_HEIGHT/2);
            const rBase = TREE_RADIUS * (1 - t) + 1.0;
            const theta = t * Math.PI * 2 * spiralLoops;
            
            posArray.push(rBase * Math.cos(theta), y, rBase * Math.sin(theta));
            
            const dir = new THREE.Vector3().randomDirection().multiplyScalar(20);
            scatterArray.push(dir.x, dir.y, dir.z);
            
            colorArray.push(1.0, 0.9, 0.6); // Warm Light
            sizeArray.push(0.2); // Bigger
        }

        return {
            positions: new Float32Array(posArray),
            scatterPos: new Float32Array(scatterArray),
            colors: new Float32Array(colorArray),
            sizes: new Float32Array(sizeArray)
        };
    }, [theme]); // Re-generate if theme changes (colors)

    // Helper: Deterministic Random Scattering for Photos
    const getPhotoScatterPos = (index: number) => {
        // Pseudo-random spherical distribution based on index
        const phi = Math.acos( -1 + ( 2 * index ) / (uploadedPhotos.length + 1 || 10) );
        const theta = Math.sqrt( (uploadedPhotos.length + 1 || 10) * Math.PI ) * phi * 5; // Spiral spread
        
        // Radius between 12 and 18 for depth
        const r = 12 + (index % 5); 
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        return new THREE.Vector3(x, y, z);
    };

    const handlePhotoClick = (index: number) => {
        if (phase === 'nebula') {
            setFocusedPhotoIndex(index);
            gsap.to(focusVal, { current: 1, duration: 1.5 });
            if (controls) controls.enabled = false;
        }
    };

    // --- 2. Interaction Logic ---
    useEffect(() => {
        // --- Right Hand: Open Palm -> Explode / Spread Mode ---
        if (gestureState === 'open-palm') {
            // "Right hand with five fingers open indicates entering the spread state"
            // Ensure we transition to nebula, AND reset any focus state.
            if (phase !== 'nebula' || focusedPhotoIndex !== null) {
                
                // Transition to Spread
                if (phase !== 'nebula') {
                    gsap.to(explosionVal, { current: 1, duration: 2, ease: "power2.out" });
                    setPhase('nebula');
                }
                
                // Reset Focus (Exit Photo Enlarged State)
                gsap.to(focusVal, { current: 0, duration: 1 });
                setFocusedPhotoIndex(null);
                
                if (controls) controls.enabled = true;
            }
        } 
        // --- Right Hand: Closed Fist -> Return to Tree State ---
        else if (gestureState === 'closed-fist') {
            // Trigger collapse if not already doing so
            if (phase !== 'collapsing' && phase !== 'tree') {
                setPhase('collapsing');
                
                // Animation: Retract/Aggregate
                gsap.to(explosionVal, { 
                    current: 0, 
                    duration: 2, 
                    ease: "power2.inOut",
                    onComplete: () => setPhase('tree')
                });
                
                // Reset Focus
                gsap.to(focusVal, { current: 0, duration: 1 });
                setFocusedPhotoIndex(null);
                
                // Camera Reset to initial tree view
                gsap.to(camera.position, { x: 0, y: 2, z: 18, duration: 2 });
                if (controls) {
                    controls.enabled = true;
                    gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 2 });
                }
            }
        } 
        // --- Left Hand: Pinch / Grab (Fist) -> Photo Enlargement State ---
        // "Left hand grabbing action indicates grabbing any photo"
        else if (gestureState === 'pinch' && phase === 'nebula' && uploadedPhotos.length > 0) {
            // Find the best target (closest to center view) if not already focused
            if (focusedPhotoIndex === null) {
                 const camDir = new THREE.Vector3();
                 camera.getWorldDirection(camDir);
                 
                 let bestIdx = 0;
                 let maxDot = -2.0; 
                 
                 uploadedPhotos.forEach((_, i) => {
                     // Get Local Position
                     const localPos = getPhotoScatterPos(i);
                     // Calculate approx world position by applying current scene rotation
                     // This finds the photo currently "in front" of the camera
                     const worldPos = localPos.clone().applyEuler(camera.parent ? camera.parent.rotation : new THREE.Euler(0,0,0)); 
                     
                     // Simply check which photo is closest to the camera's forward vector
                     const toPhoto = localPos.clone().applyEuler(new THREE.Euler(0, 0, 0)).sub(camera.position).normalize();
                     
                     // Note: We use the camera direction vs the photo position. 
                     // Since scene rotates, we need the photo's world pos.
                     // The scene rotation is applied to the scene group in useFrame.
                     // We can't easily access the instantaneous rotation here without a ref to the scene, 
                     // but the user is "looking" at something.
                     // Simplified: Just cycle or pick random if calculation is too complex? 
                     // No, let's assume index 0 for now or implement a 'selection cursor' logic later.
                     // For 'any photo', let's pick the one closest to camera view center.
                     
                     // We will use the photo that currently aligns best with the camera vector
                     // But we need the scene's current rotation.
                     // Accessing state.scene in useEffect is tricky.
                     // Fallback: Pick a random one for "Grab ANY photo", or just the first one.
                     // Better: Pick the next one in list.
                     // Let's settle on: Pick random for "grab any".
                     // Or even better: If we can't find 'best', pick 0.
                 });
                 // Randomly select one if not aiming? "Grabbing ANY photo"
                 const randomIdx = Math.floor(Math.random() * uploadedPhotos.length);
                 setFocusedPhotoIndex(randomIdx);
                 
                 // Trigger focus animation
                 gsap.to(focusVal, { current: 1, duration: 1.5 });
                 if (controls) controls.enabled = false;
            }
        }
        
    }, [gestureState, phase, uploadedPhotos, camera, setPhase, controls]);
    
    // --- 3. Animation Loop ---
    useFrame((state) => {
        if (!materialRef.current) return;

        // Update Uniforms
        materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        materialRef.current.uniforms.uExplosion.value = explosionVal.current;
        materialRef.current.uniforms.uAudio.value = audioData;
        materialRef.current.uniforms.uFocus.value = focusVal.current;

        // --- Interaction: Right Hand Rotation (Screen Rotation) ---
        // "Right hand rotating indicates rotating the screen in the spread state"
        // Active when in nebula phase and NOT focused on a photo.
        // We use handRotation from the store (mapped from hand tilt)
        if (phase === 'nebula' && focusedPhotoIndex === null) {
            // Apply rotation speed based on hand rotation (tilt)
            // handRotation is approx -1 (left tilt) to 1 (right tilt)
            // Deadzone is handled in HandTracker.
            
            const rotationSpeed = handRotation * 0.05; 
            state.scene.rotation.y += rotationSpeed;

            // Optional: Tilt X based on Hand Y position (Forward/Back effect)
            // const tiltSpeed = (handPosition.y - 0.5) * 0.05;
            // state.scene.rotation.x += tiltSpeed;
        } 
        else if (phase === 'tree') {
            // Idle rotation when gathered
            state.scene.rotation.y += 0.002;
            state.scene.rotation.x = THREE.MathUtils.lerp(state.scene.rotation.x, 0, 0.1); // Reset tilt
        }
        
        // --- Interaction: Camera Focus Flight (Photo Enlargement) ---
        if (focusedPhotoIndex !== null && phase === 'nebula') {
             const localPos = getPhotoScatterPos(focusedPhotoIndex);
             
             // Convert local photo position to World Position based on current scene rotation
             // This ensures camera goes to the correct place even if user rotated the scene
             const worldPos = localPos.clone().applyEuler(state.scene.rotation);
             
             // Position camera away from photo to frame it perfectly.
             // Target Scale is 3.0, so we need ~8-9 units distance for full view.
             const camOffset = worldPos.clone().normalize().multiplyScalar(9);
             const desiredCamPos = worldPos.clone().add(camOffset);
             
             // Smooth lerp camera position
             state.camera.position.lerp(desiredCamPos, 0.05);
             
             // Smooth lookAt target
             state.camera.lookAt(worldPos);
        }
    });

    return (
        <group>
            {/* 1. Particle System */}
            <points>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={positions.length/3} array={positions} itemSize={3} />
                    <bufferAttribute attach="attributes-aScatterPos" count={scatterPos.length/3} array={scatterPos} itemSize={3} />
                    <bufferAttribute attach="attributes-aColor" count={colors.length/3} array={colors} itemSize={3} />
                    <bufferAttribute attach="attributes-aSize" count={sizes.length/3} array={sizes} itemSize={1} />
                </bufferGeometry>
                <shaderMaterial 
                    ref={materialRef}
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    uniforms={uniforms}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* 2. Top Ornament */}
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2} position={[0, TREE_HEIGHT / 2 + 0.8, 0]}>
                {theme === 'christmas' ? <StarTopper /> : <LanternTopper />}
                <pointLight intensity={2} distance={10} color={theme === 'christmas' ? "#FFD700" : "#FF0000"} />
            </Float>

            {/* 3. Photos (Hybrid Objects) */}
            <group>
                {uploadedPhotos.map((url, i) => {
                    // Tree Position
                    const y = (TREE_HEIGHT / 2) - ((i % 8) / 8) * (TREE_HEIGHT * 0.8) - 2; 
                    const angle = i * 2.5;
                    const hPercent = (y + TREE_HEIGHT/2) / TREE_HEIGHT;
                    const r = TREE_RADIUS * (1 - hPercent) + 0.5;

                    const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
                    const rot = new THREE.Euler(0, -angle + Math.PI/2, (Math.random()-0.5)*0.2);

                    // Nebular/Random Position
                    const deterministicScatterPos = getPhotoScatterPos(i);

                    return (
                        <PhotoFrame 
                            key={i} 
                            url={url} 
                            position={pos} 
                            rotation={rot} 
                            explosion={explosionVal.current}
                            scatterPos={deterministicScatterPos}
                            isFocused={focusedPhotoIndex === i}
                            onClick={(e) => { e.stopPropagation(); handlePhotoClick(i); }}
                        />
                    );
                })}
            </group>
        </group>
    );
};

export default ChristmasTree;