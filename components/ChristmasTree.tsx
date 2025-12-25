import React, { useMemo, useRef, useLayoutEffect, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useStore } from '../store/useStore';

// --- Configuration ---
const TREE_HEIGHT = 12;
const TREE_RADIUS = 3.6; 
const PARTICLE_COUNT = 5000;

// Ornament Colors
const ORNAMENT_COLORS = [
  '#DAA520', // Retro Gold
  '#722F37', // Wine Red
  '#536872', // Gray-Blue
  '#FF66CC', // Rose Pink
  '#F7E7CE', // Champagne
];

// Custom Star Geometry Helper
const StarTopper: React.FC = () => {
  const { shape, settings } = useMemo(() => {
    const s = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.8;
    const innerRadius = 0.4;
    const step = Math.PI / points;
    
    // Draw star shape
    for (let i = 0; i < 2 * points; i++) {
      const r = (i % 2 === 0) ? outerRadius : innerRadius;
      const a = i * step;
      const x = r * Math.sin(a);
      const y = r * Math.cos(a);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();

    const settings = {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.05,
      bevelSegments: 3
    };

    return { shape: s, settings };
  }, []);

  return (
    <mesh rotation={[0, 0, 0]}>
      <extrudeGeometry args={[shape, settings]} />
      <meshStandardMaterial 
        color="#FFD700" 
        emissive="#FFD700" 
        emissiveIntensity={2.5} 
        roughness={0.2} 
        metalness={0.8} 
        toneMapped={false}
      />
    </mesh>
  );
};

// --- Spiral Light Ribbon Component ---
const SpiralRibbon: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    // Ribbon Configuration
    const particleCount = 1500;
    const loops = 8; // Number of turns around the tree
    const ribbonWidth = 0.6; // Spread of the ribbon
    
    const particles = useMemo(() => {
        const data = [];
        for (let i = 0; i < particleCount; i++) {
            // Normalized position along the length (0 to 1)
            const t = i / particleCount; 
            
            // Height mapping: Bottom (-H/2) to Top (H/2)
            const y = (t * TREE_HEIGHT) - (TREE_HEIGHT / 2);
            
            // Calculate cone radius at this height
            const heightPercent = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
            const coneRadius = TREE_RADIUS * (1 - heightPercent);
            
            // Radius of ribbon (Outermost layer)
            // Adjusted to be significantly larger than tree + photos to avoid clipping
            const baseRadius = coneRadius + 1.6; 
            
            // Spiral Angle
            const angle = t * Math.PI * 2 * loops;
            
            // Add randomness to create a "ribbon" width effect rather than a single line
            const randomOffset = (Math.random() - 0.5) * ribbonWidth;
            
            // Calculate position
            const x = Math.cos(angle) * (baseRadius + Math.random() * 0.1); 
            const z = Math.sin(angle) * (baseRadius + Math.random() * 0.1);
            const finalY = y + randomOffset * 0.5;
            
            data.push({
                pos: new THREE.Vector3(x, finalY, z),
                scale: Math.random() * 0.08 + 0.04
            });
        }
        return data;
    }, []);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        particles.forEach((p, i) => {
            dummy.position.copy(p.pos);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [particles, dummy]);

    useFrame((state, delta) => {
        if (meshRef.current) {
            // Continuous Y-axis rotation to create "flowing upwards" illusion
            meshRef.current.rotation.y -= delta * 0.5; 
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial 
                color={new THREE.Color("#FFD700")}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                transparent
                opacity={0.8}
            />
        </instancedMesh>
    );
};

// --- Single Photo Component (Polaroid Style) ---
interface PhotoFrameProps {
    url: string;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale?: number;
}

const PhotoFrame: React.FC<PhotoFrameProps> = ({ url, position, rotation, scale = 1 }) => {
    const meshRef = useRef<THREE.Group>(null);
    const texture = useLoader(THREE.TextureLoader, url);
    
    // Random sway parameters
    const randomPhase = useMemo(() => Math.random() * Math.PI * 2, []);
    const randomSpeed = useMemo(() => 0.5 + Math.random() * 0.5, []);

    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.getElapsedTime();
        // Gentle swaying rotation
        meshRef.current.rotation.z = rotation.z + Math.sin(time * randomSpeed + randomPhase) * 0.05;
        // Slight vertical bobbing
        meshRef.current.position.y = position.y + Math.cos(time * randomSpeed * 1.5 + randomPhase) * 0.05;
    });

    return (
        <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
            {/* White Polaroid Border */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.2, 1.5, 0.02]} />
                <meshStandardMaterial color="#f0f0f0" roughness={0.8} />
            </mesh>
            {/* Photo Content */}
            <mesh position={[0, 0.15, 0.02]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

// --- Collection of User Photos ---
const PhotoCollection: React.FC<{ uploadedPhotos: string[] }> = ({ uploadedPhotos }) => {
    if (uploadedPhotos.length === 0) return null;

    return (
        <group>
            {uploadedPhotos.map((url, i) => {
                // Spiral distribution logic
                const angle = i * 1.5; // Spread around circle
                const heightRange = TREE_HEIGHT * 0.8;
                // Distribute evenly from top to bottom based on index
                const y = (TREE_HEIGHT / 2) - ((i % 10) / 10) * heightRange - 1; 
                
                // Calculate radius at this height (Cone shape)
                const heightPercent = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
                const radiusAtHeight = TREE_RADIUS * (1 - heightPercent);
                
                // Radius: Middle Layer (Between Tree Surface and Ribbon)
                // Tree Surface ~ radiusAtHeight
                // Ribbon ~ radiusAtHeight + 1.6
                const r = radiusAtHeight + 0.6; 
                
                const x = Math.cos(angle) * r;
                const z = Math.sin(angle) * r;
                
                const position = new THREE.Vector3(x, y, z);
                
                // Rotation to face outwards
                const rotation = new THREE.Euler(0, -angle + Math.PI / 2, 0); 
                
                // Simple billboard-ish logic: Rotate Y to match angle
                const lookAtPos = new THREE.Vector3(0, y, 0);
                const obj3d = new THREE.Object3D();
                obj3d.position.copy(position);
                obj3d.lookAt(lookAtPos);
                // Invert rotation so it faces OUT
                obj3d.rotateY(Math.PI);
                // Add random tilt
                obj3d.rotateZ((Math.random() - 0.5) * 0.2);

                return (
                    <PhotoFrame 
                        key={`${url}-${i}`} 
                        url={url} 
                        position={position} 
                        rotation={obj3d.rotation}
                        scale={0.8}
                    />
                );
            })}
        </group>
    );
}

const ChristmasTree: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { phase, setPhase, gestureState, uploadedPhotos } = useStore();
  
  // Ref to track animation progress: 0 = Tree, 1 = Nebula
  const transitionRef = useRef({ value: 0 });

  // 1. Particle Generation Data
  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // --- Tree Position ---
      const y = (Math.random() * TREE_HEIGHT) - (TREE_HEIGHT / 2);
      const heightPercent = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
      const maxRadius = TREE_RADIUS * (1 - heightPercent);
      const radiusRatio = 0.5 + (Math.random() * 0.5); 
      const r = maxRadius * radiusRatio;
      const angle = Math.random() * Math.PI * 2;
      
      const treeX = r * Math.cos(angle);
      const treeZ = r * Math.sin(angle);
      const treePos = new THREE.Vector3(treeX, y, treeZ);

      // --- Nebula Position (Explosion) ---
      const nebulaR = 8 + Math.random() * 12; 
      const nebulaTheta = Math.random() * Math.PI * 2;
      const nebulaPhi = Math.acos((Math.random() * 2) - 1);
      const nebulaX = nebulaR * Math.sin(nebulaPhi) * Math.cos(nebulaTheta);
      const nebulaY = nebulaR * Math.sin(nebulaPhi) * Math.sin(nebulaTheta);
      const nebulaZ = nebulaR * Math.cos(nebulaPhi);
      const nebulaPos = new THREE.Vector3(nebulaX, nebulaY, nebulaZ);

      const color = new THREE.Color().setHSL(
        0.25 + Math.random() * 0.1,  
        0.95,                        
        0.6 + Math.random() * 0.3    
      );

      data.push({
        treePos: treePos,
        nebulaPos: nebulaPos,
        position: treePos.clone(),
        rotation: new THREE.Euler(
            Math.random() * Math.PI * 2, 
            Math.random() * Math.PI * 2, 
            Math.random() * Math.PI * 2
        ),
        scale: Math.random() * 0.15 + 0.1,
        color: color,
        speed: Math.random() * 1.5 + 0.5,
        staggerDelay: (treePos.length() / (TREE_HEIGHT)) * 0.5 
      });
    }
    return data;
  }, []);

  // 2. Initial Setup
  useLayoutEffect(() => {
    if (meshRef.current) {
      particles.forEach((particle, i) => {
        dummy.position.copy(particle.position);
        dummy.rotation.copy(particle.rotation);
        dummy.scale.setScalar(particle.scale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        meshRef.current!.setColorAt(i, particle.color);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles, dummy]);

  // 3. Handle Transitions
  useEffect(() => {
    if (phase === 'tree' && gestureState === 'open-palm') {
        gsap.to(transitionRef.current, {
            value: 1,
            duration: 2,
            ease: "power2.out",
            onComplete: () => setPhase('nebula')
        });
    } else if (phase === 'nebula' && gestureState === 'closed-fist') {
        gsap.to(transitionRef.current, {
            value: 0,
            duration: 2,
            ease: "power2.in",
            onComplete: () => setPhase('tree')
        });
    }
  }, [phase, gestureState, setPhase]);

  // 4. Animation Loop
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();
    const raycaster = state.raycaster;
    const progress = transitionRef.current.value;
    
    raycaster.setFromCamera(state.pointer, state.camera);
    const ray = raycaster.ray;

    const closestPoint = new THREE.Vector3();
    const basePos = new THREE.Vector3();
    const targetPos = new THREE.Vector3();
    const pushDir = new THREE.Vector3();

    particles.forEach((particle, i) => {
      const staggerStrength = 0.5;
      const localProgress = THREE.MathUtils.clamp(
          (progress * (1 + staggerStrength) - (particle.staggerDelay * staggerStrength)),
          0, 1
      );
      
      basePos.lerpVectors(particle.treePos, particle.nebulaPos, localProgress);

      ray.closestPointToPoint(basePos, closestPoint);
      const distance = basePos.distanceTo(closestPoint);
      
      targetPos.copy(basePos);
      
      if (distance < 2.0) {
        pushDir.copy(basePos).sub(closestPoint).normalize();
        const pushForce = (2.0 - distance) * 1.5;
        targetPos.add(pushDir.multiplyScalar(pushForce));
      }

      targetPos.y += Math.sin(time * particle.speed + particle.treePos.x) * 0.05;

      particle.position.lerp(targetPos, 0.1);

      dummy.position.copy(particle.position);
      dummy.rotation.copy(particle.rotation);
      dummy.rotation.y += 0.05 * particle.speed; 
      dummy.rotation.x += 0.02 * particle.speed;
      dummy.scale.setScalar(particle.scale);
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[0, -1, 0]}>
      {/* Main Tree Particles */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <tetrahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial 
            roughness={0.15} 
            metalness={0.5}
            side={THREE.DoubleSide}
            emissive="#00ff00" 
            emissiveIntensity={1.0} 
            toneMapped={false} 
        />
      </instancedMesh>

      {/* Ornaments - Hide in Nebula Phase */}
      <group visible={phase === 'tree' || transitionRef.current.value < 0.5}>
        <Ornaments transitionRef={transitionRef} />
      </group>

      {/* Spiral Light Ribbon - Hide in Nebula Phase */}
      <group visible={phase === 'tree' || transitionRef.current.value < 0.2}>
         <SpiralRibbon />
      </group>

      {/* User Photos - Always visible but best seen in Tree Phase */}
      <group>
        <PhotoCollection uploadedPhotos={uploadedPhotos} />
      </group>

      {/* Top Star */}
      <group visible={phase === 'tree' || transitionRef.current.value < 0.8}>
          <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
            <group position={[0, TREE_HEIGHT / 2 + 0.2, 0]}>
                <StarTopper />
                <pointLight intensity={3} distance={6} color="#FFD700" decay={2} />
            </group>
          </Float>
      </group>

      {/* Floating Snowflakes */}
      <Sparkles 
        count={200} 
        scale={[12, 14, 12]} 
        size={4} 
        speed={0.5} 
        opacity={0.8}
        color="#ffffff"
        position={[0, 0, 0]}
      />
    </group>
  );
};

// --- Ornaments Sub-component ---
interface OrnamentsProps {
    transitionRef: React.MutableRefObject<{ value: number }>;
}

const Ornaments: React.FC<OrnamentsProps> = ({ transitionRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  const ornamentData = useMemo(() => {
    const data = [];
    const count = 50; 
    const turns = 7; 
    
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const y = (progress * TREE_HEIGHT) - (TREE_HEIGHT / 2) + 0.8; 
      const heightPercent = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
      const currentRadius = TREE_RADIUS * (1 - heightPercent);
      const r = currentRadius * 0.95; 
      const angle = progress * Math.PI * 2 * turns;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const treePos = new THREE.Vector3(x, y, z);
      
      const nebulaDir = treePos.clone().normalize();
      const nebulaPos = treePos.clone().add(nebulaDir.multiplyScalar(Math.random() * 15 + 10));

      const color = ORNAMENT_COLORS[i % ORNAMENT_COLORS.length];
      
      data.push({ treePos, nebulaPos, color });
    }
    return data;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const progress = transitionRef.current.value;

    groupRef.current.children.forEach((mesh, i) => {
        const data = ornamentData[i];
        mesh.position.lerpVectors(data.treePos, data.nebulaPos, progress);
        mesh.rotation.x = progress * Math.PI * 2;
        mesh.rotation.z = progress * Math.PI;
    });
  });

  return (
    <group ref={groupRef}>
      {ornamentData.map((data, i) => (
        <mesh key={i} position={data.treePos} castShadow receiveShadow>
          <sphereGeometry args={[0.25, 32, 32]} />
          <meshStandardMaterial 
            color={data.color} 
            roughness={0.2}
            metalness={0.9}
            emissive={data.color}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

export default ChristmasTree;