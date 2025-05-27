import React, { Suspense, useRef, useEffect, useState, forwardRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import ChessboardFloor from './ChessboardFloor'; // Added back missing import
import { OrbitControls } from '@react-three/drei'; // Added OrbitControls import

// --- Define camera constants for FollowCamera ---
const CAMERA_LOCAL_OFFSET = new THREE.Vector3(0, 3.0, -8); // Camera position: directly behind (negative Z), moderate height (Y)
const CAMERA_LOOK_AT_OFFSET = new THREE.Vector3(0, 1.5, 0); // Point at the upper body of the model
const CAMERA_SMOOTH_SPEED = 5.0; // Increased for more responsive camera movement
// --------------------------------------------------

// --- Define unique animation names --- 
const IDLE_ANIM_NAME = 'Armature|mixamo.com|Layer0'; // Actual name from Idle.glb
const MOVEMENT_ANIM_NAME = 'Walk';                   // New unique name for the movement animation
const ATTACK_ANIM_NAME = 'Attack';                   // New unique name for the attack animation
const KICK_ANIM_ORIGINAL_NAME = 'Armature|mixamo.com|Layer0'; // Corrected: Name from Kicking.glb (uses |)
const EMOTE_ANIM_NAME = 'Dancing';                 // New unique name for the emote animation
const EMOTE_ANIM_ORIGINAL_NAME = 'Armature|mixamo.com|Layer0'; // Corrected: Name from Swing Dancing.glb (uses | and ends in Layer0)
// ----------------------------------------------------------

const Model = forwardRef(({ modelPath, ...props }, ref) => {
  const { scene: modelScene, animations: modelAnimationsOriginal } = useGLTF(modelPath);
  const { animations: idleAnimationsOriginal } = useGLTF('/models/Idle.glb');
  const { animations: attackAnimationsOriginal } = useGLTF('/models/Kicking.glb');
  const { animations: emoteAnimationsOriginal } = useGLTF('/models/Swing Dancing.glb');

  // State for animation and movement
  const [isMoving, setIsMoving] = useState(false);
  const keysPressed = useRef({});
  const moveSpeed = 0.05;
  const rotationSpeed = 0.03;
  const currentAction = useRef(null);
  const [triggerAnimationEffect, setTriggerAnimationEffect] = useState(0);
  const attackRequested = useRef(false);
  const attackInProgress = useRef(false);
  const emoteRequested = useRef(false);
  const emoteInProgress = useRef(false);
  const targetRotation = useRef(0);

  // Function to find and rename a walk animation
  const processWalkAnimation = (animations, modelName) => {
    if (!animations || animations.length === 0) {
      console.warn(`[AnimationSetup] No animations found for ${modelName}`);
      return null;
    }

    // Log available animations for debugging
    console.log(`[AnimationSetup] Available animations for ${modelName}:`, 
      animations.map(a => a.name).join(', '));

    // Try to find a walk animation by name
    const walkClip = animations.find(clip => 
      clip.name.toLowerCase().includes('walk') || 
      clip.name.toLowerCase().includes('run') ||
      clip.name.toLowerCase().includes('move') ||
      clip.name.toLowerCase().includes('layer0')
    );

    if (walkClip) {
      const renamedClip = walkClip.clone();
      renamedClip.name = MOVEMENT_ANIM_NAME;
      console.log(`[AnimationSetup] Found walk animation for ${modelName}: '${renamedClip.name}' (Original: '${walkClip.name}')`);
      return renamedClip;
    }

    // If no walk animation found, use the first animation as fallback
    const fallbackClip = animations[0].clone();
    fallbackClip.name = MOVEMENT_ANIM_NAME;
    console.log(`[AnimationSetup] Using fallback animation for ${modelName}: '${fallbackClip.name}' (Original: '${animations[0].name}')`);
    return fallbackClip;
  };

  // Add keyboard and mouse controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      keysPressed.current[key] = true;
      if (key === 'e' && !attackInProgress.current && !emoteInProgress.current) {
        console.log('[Input] Emote requested (E key)');
        emoteRequested.current = true;
        setTriggerAnimationEffect(prev => prev + 1);
      }
    };

    const handleKeyUp = (event) => {
      keysPressed.current[event.key.toLowerCase()] = false;
    };

    const handleMouseDown = (event) => {
      if (event.button === 0 && !attackInProgress.current && !emoteInProgress.current) {
        console.log('[Input] Attack requested (left click)');
        attackRequested.current = true;
        setTriggerAnimationEffect(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Add model visibility debugging
  useEffect(() => {
    console.log('[Model] Loading model:', modelPath);
    if (!modelScene) {
      console.error('[Model] Failed to load model scene:', modelPath);
      return;
    }
    console.log('[Model] Successfully loaded model:', modelPath);
    console.log('[Model] Available animations:', modelAnimationsOriginal?.map(a => a.name).join(', '));

    // Debug model properties and adjust position
    modelScene.traverse((child) => {
      if (child.isMesh) {
        console.log('[Model] Found mesh:', child.name);
        console.log('[Model] Mesh position:', child.position);
        console.log('[Model] Mesh scale:', child.scale);
        console.log('[Model] Mesh visible:', child.visible);
        
        // Ensure mesh is visible and has proper material
        child.visible = true;
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Adjust position and scale based on model type
        if (modelPath === '/models/queen/queen-omni.glb') {
          // Queen model specific adjustments
          child.position.y = 0;
          // Adjust scale to be more proportional
          child.scale.set(1.0, 1.0, 1.0);
          // Ensure proper rotation
          child.rotation.set(0, 0, 0);
        } else {
          // Default model adjustments
          child.position.y = -2.0;
          child.scale.set(1.0, 1.0, 1.0);
        }
        
        // Ensure material is properly set
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1;
          child.material.needsUpdate = true;
        }
      }
    });

    // Adjust the entire model's position and scale
    if (modelPath === '/models/queen/queen-omni.glb') {
      modelScene.position.set(0, 0, 0);
      modelScene.scale.set(1.0, 1.0, 1.0);
      modelScene.rotation.set(0, 0, 0);
    } else {
      modelScene.position.y = -2.0;
    }
  }, [modelPath, modelScene, modelAnimationsOriginal]);

  // State to hold the processed animations that will be passed to useAnimations
  const [animationsToUse, setAnimationsToUse] = useState([]);
  const [modelError, setModelError] = useState(null);

  useEffect(() => {
    console.log('[AnimationSetup] Processing loaded animations...');
    
    let finalAnimations = [];
    
    if (modelPath === '/models/queen/queen-omni.glb') {
      // Skip animations for queen model
      console.log('[AnimationSetup] Skipping animations for queen model');
      setAnimationsToUse([]);
      setModelError(null);
      return;
    }
    
    // Process animations for default model
    if (modelAnimationsOriginal && modelAnimationsOriginal.length > 0) {
      const walkClip = processWalkAnimation(modelAnimationsOriginal, 'default');
      if (walkClip) {
        finalAnimations.push(walkClip);
      }
    }

    // Process attack animations
    if (attackAnimationsOriginal && attackAnimationsOriginal.length > 0) {
      const attackClip = attackAnimationsOriginal.find(clip => clip.name === KICK_ANIM_ORIGINAL_NAME);
      if (attackClip) {
        const renamedAttackClip = attackClip.clone();
        renamedAttackClip.name = ATTACK_ANIM_NAME;
        finalAnimations.push(renamedAttackClip);
      }
    }

    // Process emote animations
    if (emoteAnimationsOriginal && emoteAnimationsOriginal.length > 0) {
      const emoteClip = emoteAnimationsOriginal.find(clip => clip.name === EMOTE_ANIM_ORIGINAL_NAME);
      if (emoteClip) {
        const renamedEmoteClip = emoteClip.clone();
        renamedEmoteClip.name = EMOTE_ANIM_NAME;
        finalAnimations.push(renamedEmoteClip);
      }
    }
    
    console.log('[AnimationSetup] Final animations:', finalAnimations.map(a => a.name).join(', '));
    setAnimationsToUse(finalAnimations);
    setModelError(null);
  }, [modelPath, modelAnimationsOriginal, idleAnimationsOriginal, attackAnimationsOriginal, emoteAnimationsOriginal]);

  const { actions, mixer } = useAnimations(animationsToUse, ref);

  // Animation switching logic
  useEffect(() => {
    if (modelPath === '/models/queen/queen-omni.glb') {
      // Skip animation logic for queen model
      return;
    }

    if (!actions || Object.keys(actions).length === 0 || !mixer) {
      console.log('[AnimationDebug] No actions or mixer available');
      return;
    }

    console.log('[AnimationDebug] Available actions:', Object.keys(actions));
    const idleAction = actions[IDLE_ANIM_NAME];
    const moveAction = actions[MOVEMENT_ANIM_NAME];
    const attackAction = actions[ATTACK_ANIM_NAME];
    const emoteAction = actions[EMOTE_ANIM_NAME];

    // Attack Logic
    if (attackRequested.current && attackAction && !attackInProgress.current) {
      attackRequested.current = false;
      attackInProgress.current = true;
      emoteRequested.current = false;
      emoteInProgress.current = false;

      if (currentAction.current && currentAction.current !== attackAction) {
        currentAction.current.fadeOut(0.2);
      }
      attackAction.reset().setLoop(THREE.LoopOnce, 1).play();
      attackAction.clampWhenFinished = true;
      currentAction.current = attackAction;

      const onAttackFinished = (event) => {
        if (event.action === attackAction) {
          attackInProgress.current = false;
          mixer.removeEventListener('finished', onAttackFinished);
          setTriggerAnimationEffect(prev => prev + 1);
        }
      };
      mixer.addEventListener('finished', onAttackFinished);
      return;
    }

    // Emote Logic
    if (emoteRequested.current && emoteAction && !emoteInProgress.current) {
      emoteRequested.current = false;
      emoteInProgress.current = true;

      if (currentAction.current && currentAction.current !== emoteAction) {
        currentAction.current.fadeOut(0.2);
      }
      emoteAction.reset().setLoop(THREE.LoopOnce, 1).play();
      emoteAction.timeScale = 0.5;
      emoteAction.clampWhenFinished = true;
      currentAction.current = emoteAction;

      const onEmoteFinished = (event) => {
        if (event.action === emoteAction) {
          emoteInProgress.current = false;
          mixer.removeEventListener('finished', onEmoteFinished);
          setTriggerAnimationEffect(prev => prev + 1);
        }
      };
      mixer.addEventListener('finished', onEmoteFinished);
      return;
    }

    // Idle/Move Logic
    let targetAction = null;
    if (isMoving && moveAction) {
      console.log('[AnimationDebug] Switching to move animation');
      targetAction = moveAction;
    } else if (!isMoving && idleAction) {
      console.log('[AnimationDebug] Switching to idle animation');
      targetAction = idleAction;
    }

    if (!targetAction) {
      console.log('[AnimationDebug] No target action available');
      return;
    }

    if (currentAction.current === targetAction) {
      if (!targetAction.isRunning()) {
        console.log('[AnimationDebug] Restarting current animation');
        targetAction.play();
      }
      if (targetAction.loop !== THREE.LoopRepeat) {
        targetAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      return;
    }

    if (currentAction.current) {
      console.log('[AnimationDebug] Fading out current animation');
      currentAction.current.fadeOut(0.2);
    }

    console.log('[AnimationDebug] Starting new animation:', targetAction.getClip().name);
    targetAction.reset();
    targetAction.setLoop(THREE.LoopRepeat, Infinity);
    // Adjust animation speeds
    if (targetAction.getClip().name === MOVEMENT_ANIM_NAME) {
      targetAction.timeScale = modelPath === '/models/queen/queen-omni.glb' ? 0.5 : 1.0; // Slower for queen
    } else if (targetAction.getClip().name === IDLE_ANIM_NAME) {
      targetAction.timeScale = modelPath === '/models/queen/queen-omni.glb' ? 0.7 : 1.0; // Slightly slower for queen
    } else {
      targetAction.timeScale = 1.0; // Normal speed for other animations
    }
    targetAction.fadeIn(0.2).play();
    currentAction.current = targetAction;
  }, [isMoving, actions, mixer, triggerAnimationEffect, modelPath]);

  // Movement and animation update
  useFrame((state, delta) => {
    if (!ref.current) return;

    const moveDirection = new THREE.Vector3();
    let currentlyMoving = false;
    let isTurning = false;

    // Get camera direction for relative movement
    const cameraDirection = new THREE.Vector3();
    state.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement horizontal
    cameraDirection.normalize();

    // Calculate right vector for strafing
    const right = new THREE.Vector3().crossVectors(state.camera.up, cameraDirection).normalize();

    // Handle movement
    if (keysPressed.current['w']) {
      moveDirection.add(cameraDirection);
      currentlyMoving = true;
    }
    if (keysPressed.current['s']) {
      moveDirection.sub(cameraDirection);
      currentlyMoving = true;
    }

    // Handle turning
    if (keysPressed.current['a']) {
      targetRotation.current += rotationSpeed;
      isTurning = true;
      currentlyMoving = true;
    }
    if (keysPressed.current['d']) {
      targetRotation.current -= rotationSpeed;
      isTurning = true;
      currentlyMoving = true;
    }

    // Smooth rotation with interpolation
    const currentRotation = ref.current.rotation.y;
    const rotationDiff = targetRotation.current - currentRotation;
    
    // Normalize rotation difference to [-PI, PI]
    const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
    
    // Apply smoother rotation with interpolation
    const rotationLerpFactor = 0.05; // Reduced for more gradual turning
    ref.current.rotation.y += normalizedDiff * rotationLerpFactor;

    // Handle movement
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      
      // Calculate movement direction based on current rotation
      const forward = new THREE.Vector3(
        Math.sin(ref.current.rotation.y),
        0,
        Math.cos(ref.current.rotation.y)
      );
      
      // Move the model
      ref.current.position.x += forward.x * moveSpeed;
      ref.current.position.z += forward.z * moveSpeed;
      ref.current.position.y = modelPath === '/models/queen/queen-omni.glb' ? 0 : -2.0; // Keep model at floor level
    }

    setIsMoving(currentlyMoving);
    if (mixer) mixer.update(delta);
  });

  return <primitive 
    ref={ref} 
    object={modelScene} 
    {...props} 
    scale={modelPath === '/models/queen/queen-omni.glb' ? 1.0 : 1.0} 
    position={[0, modelPath === '/models/queen/queen-omni.glb' ? 0 : -2.0, 0]} 
  />;
});
Model.displayName = 'Model';

// --- FollowCamera Component --- 
function FollowCamera({ modelRef }) {
  const { camera } = useThree();

  // Set initial camera position and lookAt target
  useEffect(() => {
    if (modelRef.current) {
      // Set initial position behind the character
      const modelPosition = new THREE.Vector3();
      modelRef.current.getWorldPosition(modelPosition);
      
      // Position camera behind and above the model
      camera.position.set(
        modelPosition.x, 
        modelPosition.y + 3.0, 
        modelPosition.z + 8.0
      );

      // Look at the character
      const lookAtPosition = modelPosition.clone().add(CAMERA_LOOK_AT_OFFSET);
      camera.lookAt(lookAtPosition);
    }
  }, [modelRef, camera]); // Effect runs when modelRef or camera instance changes

  useFrame((state, delta) => {
    if (modelRef.current) {
      // Get current model position
      const modelPosition = new THREE.Vector3();
      modelRef.current.getWorldPosition(modelPosition);
      
      // Get model's forward direction vector
      const forward = new THREE.Vector3();
      modelRef.current.getWorldDirection(forward);
      forward.negate(); // Reverse it to get the direction behind the model
      
      // Calculate camera position: behind the model based on its orientation
      const distance = Math.abs(CAMERA_LOCAL_OFFSET.z); // Use absolute distance value
      const cameraPosition = new THREE.Vector3();
      cameraPosition.copy(modelPosition); // Start at model position
      
      // Move back along the model's facing direction
      cameraPosition.x += forward.x * distance;
      cameraPosition.z += forward.z * distance;
      
      // Add height offset
      cameraPosition.y = modelPosition.y + CAMERA_LOCAL_OFFSET.y;
      
      // Ensure minimum height
      const MIN_CAMERA_HEIGHT = 2.0;
      if (cameraPosition.y < MIN_CAMERA_HEIGHT) {
        cameraPosition.y = MIN_CAMERA_HEIGHT;
      }

      // Calculate look-at position (slightly above the model)
      const lookAtPosition = modelPosition.clone().add(CAMERA_LOOK_AT_OFFSET);

      // Smoothly move camera to desired position
      const lerpFactor = 1.0 - Math.exp(-CAMERA_SMOOTH_SPEED * delta);
      state.camera.position.lerp(cameraPosition, lerpFactor);
      
      // Look at the character
      state.camera.lookAt(lookAtPosition);
    }
  });

  return null; // This component does not render any visible elements
}
// ----------------------------------------------------------

// Menu component for the Kung Fu Chess UI
const Menu = ({ onCharacterChange, onNewGame }) => {
  const characters = [
    { id: 'model', name: 'Default Character', path: '/models/model.glb' },
    { id: 'queen', name: 'Queen', path: '/models/queen/queen-omni.glb' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '15px',
      borderRadius: '10px',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          fontSize: '32px',
          marginBottom: '5px',
          filter: 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.8))'
        }}>
          ♔
        </div>
        <h1 style={{
          margin: '0',
          fontSize: '24px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #ffd700, #ff8c00)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
        }}>
          KUNG FU CHESS
        </h1>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '10px',
          width: '100%'
        }}>
          <select 
            onChange={(e) => onCharacterChange(e.target.value)}
            style={{
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            {characters.map(char => (
              <option key={char.id} value={char.path}>
                {char.name}
              </option>
            ))}
          </select>
          <button 
            onClick={onNewGame}
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(45deg, #4CAF50, #2E7D32)',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            New Game
          </button>
          <button style={{
            padding: '8px 20px',
            background: 'linear-gradient(45deg, #2196F3, #1976D2)',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            How to Play
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Lobby component
const Lobby = ({ onBack }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.9)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1001
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 20px',
            background: 'linear-gradient(45deg, #f44336, #d32f2f)',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Back to Menu
        </button>
      </div>
      
      <h1 style={{
        fontSize: '48px',
        marginBottom: '40px',
        background: 'linear-gradient(45deg, #ffd700, #ff8c00)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }}>
        Game Lobby
      </h1>
      
      <div style={{
        display: 'flex',
        gap: '40px',
        marginBottom: '40px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          width: '300px'
        }}>
          <h2 style={{ marginBottom: '20px' }}>Player 1</h2>
          <div style={{ height: '300px', width: '300px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
            <Canvas
              shadows
              camera={{ position: [0, 2, 5], fov: 50 }}
              style={{ height: '100%', width: '100%' }}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
              <Suspense fallback={null}>
                <Model position={[0, 0, 0]} scale={1.0} modelPath="/models/model.glb" />
              </Suspense>
              <ChessboardFloor size={10} divisions={8} />
            </Canvas>
          </div>
        </div>
        
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          width: '300px'
        }}>
          <h2 style={{ marginBottom: '20px' }}>Player 2</h2>
          <div style={{ height: '300px', width: '300px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
            <Canvas
              shadows
              camera={{ position: [0, 2, 5], fov: 50 }}
              style={{ height: '100%', width: '100%' }}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
              <Suspense fallback={null}>
                <Model position={[0, 0, 0]} scale={2.0} modelPath="/models/queen/queen-omni.glb" />
              </Suspense>
              <ChessboardFloor size={10} divisions={8} />
            </Canvas>
          </div>
        </div>
      </div>
      
      <button style={{
        padding: '12px 40px',
        background: 'linear-gradient(45deg, #4CAF50, #2E7D32)',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '18px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        Start Game
      </button>
    </div>
  );
};

export default function App() {
  const modelRef = useRef();
  const [currentModelPath, setCurrentModelPath] = useState('/models/model.glb');
  const [showLobby, setShowLobby] = useState(false);

  const handleCharacterChange = (newModelPath) => {
    setCurrentModelPath(newModelPath);
  };

  const handleNewGame = () => {
    setShowLobby(true);
  };

  const handleBackToMenu = () => {
    setShowLobby(false);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {!showLobby && <Menu onCharacterChange={handleCharacterChange} onNewGame={handleNewGame} />}
      {showLobby && <Lobby onBack={handleBackToMenu} />}
      {!showLobby && (
        <Canvas
          shadows
          camera={{ position: [-5, 2, 5], fov: 50 }} 
          style={{ height: '100vh', width: '100vw', background: '#222' }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.5} 
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Suspense fallback={null}>
            <Model 
              ref={modelRef} 
              position={[0, 0, 0]} 
              scale={1.0} 
              modelPath={currentModelPath} 
            />
          </Suspense>
          <ChessboardFloor size={20} divisions={16} />
          <FollowCamera modelRef={modelRef} /> 
          <OrbitControls />
        </Canvas>
      )}
    </div>
  );
}

// Preload all models and animations
useGLTF.preload('/models/model.glb');
useGLTF.preload('/models/queen/queen-omni.glb');
useGLTF.preload('/models/Idle.glb');
useGLTF.preload('/models/Kicking.glb'); 
useGLTF.preload('/models/Swing Dancing.glb');

