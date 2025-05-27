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

const Model = forwardRef((props, ref) => {
  const { scene: modelScene, animations: modelAnimationsOriginal } = useGLTF('/model.glb');
  const { animations: idleAnimationsOriginal } = useGLTF('/Idle.glb');
  const { animations: attackAnimationsOriginal } = useGLTF('/Kicking.glb'); // Load attack animation
  const { animations: emoteAnimationsOriginal } = useGLTF('/Swing Dancing.glb'); // Load emote animation

  // State to hold the processed animations that will be passed to useAnimations
  const [animationsToUse, setAnimationsToUse] = useState([]);

  useEffect(() => {
    console.log('[AnimationSetup] Processing loaded animations...');
    let finalModelAnims = [];
    if (modelAnimationsOriginal && modelAnimationsOriginal.length > 0) {
      const clipToRename = modelAnimationsOriginal[0]; // Assuming the first animation in model.glb is for movement
      const renamedClip = clipToRename.clone(); // Clone the AnimationClip
      renamedClip.name = MOVEMENT_ANIM_NAME;    // Assign the new unique name
      finalModelAnims.push(renamedClip);
      console.log(`[AnimationSetup] Renamed model animation to: '${renamedClip.name}' (Original: '${clipToRename.name}')`);
    } else {
      console.warn("[AnimationSetup] model.glb has no animations.");
    }

    let finalIdleAnims = [];
    if (idleAnimationsOriginal && idleAnimationsOriginal.length > 0) {
      // Find the idle animation by its expected name
      const idleClip = idleAnimationsOriginal.find(clip => clip.name === IDLE_ANIM_NAME);
      if (idleClip) {
        finalIdleAnims.push(idleClip);
        console.log(`[AnimationSetup] Using idle animation from Idle.glb: '${idleClip.name}'`);
      } else {
        console.warn(`[AnimationSetup] Could not find idle animation named '${IDLE_ANIM_NAME}' in Idle.glb. Available names: ${idleAnimationsOriginal.map(c => c.name).join(', ')}. Using the first available clip from Idle.glb if any.`);
        if (idleAnimationsOriginal.length > 0) finalIdleAnims.push(idleAnimationsOriginal[0]);
      }
    } else {
      console.warn("[AnimationSetup] Idle.glb has no animations.");
    }

    let finalAttackAnims = [];
    if (attackAnimationsOriginal && attackAnimationsOriginal.length > 0) {
        const attackClip = attackAnimationsOriginal.find(clip => clip.name === KICK_ANIM_ORIGINAL_NAME);
        if (attackClip) {
            const renamedAttackClip = attackClip.clone();
            renamedAttackClip.name = ATTACK_ANIM_NAME;
            finalAttackAnims.push(renamedAttackClip);
            console.log(`[AnimationSetup] Renamed attack animation to: '${renamedAttackClip.name}' (Original: '${KICK_ANIM_ORIGINAL_NAME}')`);
        } else {
            console.warn(`[AnimationSetup] Could not find attack animation named '${KICK_ANIM_ORIGINAL_NAME}' in Kicking.glb. Available: ${attackAnimationsOriginal.map(c=>c.name).join(', ')}.`);
        }
    } else {
        console.warn("[AnimationSetup] Kicking.glb has no animations.");
    }

    let finalEmoteAnims = [];
    if (emoteAnimationsOriginal && emoteAnimationsOriginal.length > 0) {
        const emoteClip = emoteAnimationsOriginal.find(clip => clip.name === EMOTE_ANIM_ORIGINAL_NAME);
        if (emoteClip) {
            const renamedEmoteClip = emoteClip.clone();
            renamedEmoteClip.name = EMOTE_ANIM_NAME;
            finalEmoteAnims.push(renamedEmoteClip);
            console.log(`[AnimationSetup] Renamed emote animation to: '${renamedEmoteClip.name}' (Original: '${EMOTE_ANIM_ORIGINAL_NAME}')`);
        } else {
            console.warn(`[AnimationSetup] Could not find emote animation named '${EMOTE_ANIM_ORIGINAL_NAME}' in Swing Dancing.glb. Available: ${emoteAnimationsOriginal.map(c=>c.name).join(', ')}.`);
        }
    } else {
        console.warn("[AnimationSetup] Swing Dancing.glb has no animations.");
    }
    
    setAnimationsToUse([...finalModelAnims, ...finalIdleAnims, ...finalAttackAnims, ...finalEmoteAnims]);

  }, [modelAnimationsOriginal, idleAnimationsOriginal, attackAnimationsOriginal, emoteAnimationsOriginal]); // Rerun when original animations are loaded

  const { actions, mixer } = useAnimations(animationsToUse, ref); // Pass the processed animations

  // Log available actions once they are ready
  useEffect(() => {
    if (animationsToUse.length > 0 && Object.keys(actions).length > 0) {
      console.log('[AnimationSetup] Animations prepared for useAnimations:', animationsToUse.map(a => `'${a.name}'`).join(', '));
      console.log('[AnimationSetup] Available animation actions (from useAnimations):', Object.keys(actions).map(a => `'${a}'`).join(', '));
    }
  }, [animationsToUse, actions]);

  const keysPressed = useRef({});
  const moveSpeed = 0.05;
  const modelRef = ref; // Use the forwarded ref for the model's group
  const [isMoving, setIsMoving] = useState(false);
  const currentAction = useRef(null);
  const [triggerAnimationEffect, setTriggerAnimationEffect] = useState(0); // General trigger for re-evaluating animation effect
  const attackRequested = useRef(false);
  const attackInProgress = useRef(false);
  const emoteRequested = useRef(false); // For emote
  const emoteInProgress = useRef(false); // For emote

  useEffect(() => {
    const handleKeyDown = (event) => { 
        const key = event.key.toLowerCase();
        keysPressed.current[key] = true; 
        if (key === 'e' && modelRef.current && !attackInProgress.current && !emoteInProgress.current) {
            console.log('[Input] Emote requested (E key)');
            emoteRequested.current = true;
            setTriggerAnimationEffect(prev => prev + 1);
        }
    };
    const handleKeyUp = (event) => { keysPressed.current[event.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleMouseDown = (event) => {
        if (event.button === 0 && modelRef.current && !attackInProgress.current && !emoteInProgress.current) { // Left click
            console.log('[Input] Attack requested (left click)');
            attackRequested.current = true;
            setTriggerAnimationEffect(prev => prev + 1); 
        }
    };
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [modelRef]); // Re-run if modelRef changes, ensures listeners have access to it.

  useEffect(() => {
    if (mixer) mixer.timeScale = 2.5; // Significantly increased animation speed
  }, [mixer]);

  useEffect(() => {
    modelScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [modelScene]);

  // Animation switching logic
  useEffect(() => {
    console.log(`[AnimEffect Entry] Effect triggered. isMoving: ${isMoving}, attackReq: ${attackRequested.current}, emoteReq: ${emoteRequested.current}, triggerAnimEffect: ${triggerAnimationEffect}`);

    if (!actions || Object.keys(actions).length === 0 || !mixer) {
      return;
    }

    const idleAction = actions[IDLE_ANIM_NAME];
    const moveAction = actions[MOVEMENT_ANIM_NAME];
    const attackAction = actions[ATTACK_ANIM_NAME];
    const emoteAction = actions[EMOTE_ANIM_NAME]; // Get emote action

    console.log(`[AnimEffect Debug] Evaluating: attackReq: ${attackRequested.current}, attackAction: ${!!attackAction}, !attackInProg: ${!attackInProgress.current}, emoteReq: ${emoteRequested.current}, emoteAction: ${!!emoteAction}, !emoteInProg: ${!emoteInProgress.current}`);

    // --- Attack Logic (Highest Priority) --- 
    if (attackRequested.current && attackAction && !attackInProgress.current) {
      attackRequested.current = false; 
      attackInProgress.current = true;
      emoteRequested.current = false; // Cancel any pending emote if attack starts
      emoteInProgress.current = false; // Stop any active emote if attack starts

      console.log('[AnimEffect] Starting ATTACK animation:', ATTACK_ANIM_NAME);
      if (currentAction.current && currentAction.current !== attackAction) {
        currentAction.current.fadeOut(0.2);
      }
      attackAction.reset().setLoop(THREE.LoopOnce, 1).play();
      attackAction.clampWhenFinished = true; 
      currentAction.current = attackAction;

      const onAttackFinished = (event) => {
        if (event.action === attackAction) {
          console.log('[AnimEffect] Attack animation finished.');
          attackInProgress.current = false;
          mixer.removeEventListener('finished', onAttackFinished);
          setTriggerAnimationEffect(prev => prev + 1); 
        }
      };
      mixer.addEventListener('finished', onAttackFinished);
      return; 
    }
    if (attackInProgress.current) {
      console.log('[AnimEffect Debug] Attack in progress, returning early.');
      return;
    }

    // --- Emote Logic (Second Priority) ---
    if (emoteRequested.current && emoteAction && !emoteInProgress.current) {
        emoteRequested.current = false;
        emoteInProgress.current = true;
        console.log('[AnimEffect] Starting EMOTE animation:', EMOTE_ANIM_NAME);

        if (currentAction.current && currentAction.current !== emoteAction) {
            currentAction.current.fadeOut(0.2);
        }
        emoteAction.reset().setLoop(THREE.LoopOnce, 1).play(); // Play once for now
        emoteAction.timeScale = 0.5; // Slow down the emote animation to half speed
        emoteAction.clampWhenFinished = true;
        currentAction.current = emoteAction;

        const onEmoteFinished = (event) => {
            if (event.action === emoteAction) {
                console.log('[AnimEffect] Emote animation finished.');
                emoteInProgress.current = false;
                mixer.removeEventListener('finished', onEmoteFinished);
                setTriggerAnimationEffect(prev => prev + 1);
            }
        };
        mixer.addEventListener('finished', onEmoteFinished);
        return;
    }
    if (emoteInProgress.current) {
        console.log('[AnimEffect Debug] Emote in progress, returning early.');
        // If moving, interrupt emote
        if (isMoving) {
            console.log('[AnimEffect] Movement detected, interrupting emote.');
            if (emoteAction) emoteAction.fadeOut(0.2); // Fade out current emote
            emoteInProgress.current = false;
            emoteRequested.current = false;
            // Proceed to idle/move logic by not returning here, allowing it to take over.
        } else {
            return; // Continue emote if not moving
        }
    }

    // --- Idle/Move Logic (Lowest Priority) --- 
    let targetAction = null;
    if (isMoving && moveAction) {
      targetAction = moveAction;
    } else if (!isMoving && idleAction) {
      targetAction = idleAction;
    } else if (!isMoving && !idleAction && moveAction) { // Fallback if idle is missing but move exists
      console.warn("[AnimEffect] Idle action not found, and not moving. Using moveAction as fallback idle if available, but this is not ideal.");
      // Or, if you prefer to ensure it's truly idle, use the first available action if idleAction is missing.
      // targetAction = Object.values(actions)[0]; 
      targetAction = idleAction || Object.values(actions)[0]; // Fallback to first if idle not found
    } else {
      console.warn('[AnimEffect] No suitable idle or move animation found for current state.');
      return; // No action to take
    }

    if (currentAction.current === targetAction) {
        // Already playing the correct animation. Ensure it's running and looped.
        if (!targetAction.isRunning()) {
            console.log(`[AnimEffect] Target action ${targetAction.getClip().name} was not running. Playing.`);
            targetAction.play();
        }
        if (targetAction.loop !== THREE.LoopRepeat) { // Check if it's set to loop
            targetAction.setLoop(THREE.LoopRepeat, Infinity);
            console.log(`[AnimEffect] Ensured ${targetAction.getClip().name} is LoopRepeat.`);
        }
        return; // Nothing more to do if already on the correct action
    }

    // If we've reached here, it means currentAction.current !== targetAction, so a switch is needed.
    console.log(`[AnimEffect Debug] Proceeding to switch. Current: ${currentAction.current ? currentAction.current.getClip().name : 'null'}, Target: ${targetAction ? targetAction.getClip().name : 'null'}`); 
    
    if (currentAction.current) {
      currentAction.current.fadeOut(0.2);
    }

    if (targetAction) {
        targetAction.reset();
        targetAction.setLoop(THREE.LoopRepeat, Infinity); // Ensure idle/move loops

        // --- TEMPORARY DIAGNOSTIC CODE --- 
        if (targetAction.getClip().name === MOVEMENT_ANIM_NAME) {
            console.log(`[AnimEffect] Slowing down ${MOVEMENT_ANIM_NAME} for diagnostics.`);
            targetAction.timeScale = 0.2; // Play at 20% speed. Adjust as needed (e.g., 0.5 for half speed)
        } else {
            targetAction.timeScale = 1; // Ensure other animations run at normal speed
        }
        // --- END TEMPORARY DIAGNOSTIC CODE ---

        targetAction.fadeIn(0.2).play();
        currentAction.current = targetAction;
        console.log(`[AnimEffect] Switched to action: ${targetAction.getClip().name}`);
    } else if (currentAction.current) {
        // No target action, but there was a current action, so fade it out.
        currentAction.current.fadeOut(0.2);
        currentAction.current = null; 
        console.log(`[AnimEffect] No target action, faded out previous action.`);
    }

  }, [isMoving, actions, mixer, triggerAnimationEffect, IDLE_ANIM_NAME, MOVEMENT_ANIM_NAME, ATTACK_ANIM_NAME, EMOTE_ANIM_NAME]);

  useFrame((state, delta) => {
    const moveDirection = new THREE.Vector3();
    let currentlyMoving = false;
    let isTurning = false;

    if (keysPressed.current['w']) { moveDirection.z -= 1; currentlyMoving = true; }
    if (keysPressed.current['s']) { moveDirection.z += 1; currentlyMoving = true; }
    if (keysPressed.current['a']) { isTurning = true; currentlyMoving = true; }
    if (keysPressed.current['d']) { isTurning = true; currentlyMoving = true; }

    if (modelRef.current) {
      // Calculate direction based on camera
      const cameraDirection = new THREE.Vector3();
      state.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0; // Keep movement horizontal
      cameraDirection.normalize();

      const right = new THREE.Vector3().crossVectors(state.camera.up, cameraDirection).normalize();
      
      // Handle rotation first (separate from movement)
      const currentRotation = modelRef.current.quaternion.clone();
      const rotationSpeed = 0.05; // Adjust rotation speed as needed
      
      if (keysPressed.current['a']) {
        // Rotate left (counter-clockwise around Y axis)
        const turnLeft = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationSpeed);
        currentRotation.premultiply(turnLeft);
      }
      
      if (keysPressed.current['d']) {
        // Rotate right (clockwise around Y axis)
        const turnRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rotationSpeed);
        currentRotation.premultiply(turnRight);
      }
      
      // Apply rotation
      modelRef.current.quaternion.copy(currentRotation);
      
      // Handle forward/backward movement along the character's forward direction
      const characterForward = new THREE.Vector3(0, 0, -1).applyQuaternion(modelRef.current.quaternion);
      const characterRight = new THREE.Vector3(1, 0, 0).applyQuaternion(modelRef.current.quaternion);
      
      const finalMove = new THREE.Vector3();
      if (keysPressed.current['w']) finalMove.sub(characterForward); // Move forward (negative Z)
      if (keysPressed.current['s']) finalMove.add(characterForward); // Move backward (positive Z)
      
      // Apply movement if there's any
      if (finalMove.lengthSq() > 0.001) {
        finalMove.normalize().multiplyScalar(moveSpeed);
        modelRef.current.position.add(finalMove);
      }
    }
    
    // Update isMoving state only if it changes
    // Now isMoving is true for both movement and turning
    setIsMoving(prevIsMoving => {
      if (prevIsMoving !== currentlyMoving) {
        console.log(`[useFrame] isMoving changing from ${prevIsMoving} to ${currentlyMoving}`);
        return currentlyMoving;
      }
      return prevIsMoving;
    });

    if (mixer) mixer.update(delta);
  });

  return <primitive ref={ref} object={modelScene} {...props} scale={props.scale || 1} />;
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
const Menu = () => {
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
          gap: '10px',
          marginTop: '10px'
        }}>
          <button style={{
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

export default function App() {
  const modelRef = useRef();

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Menu />
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
        {/* Set model position with negative Y value to place it on the floor */}
        <Model ref={modelRef} position={[0, -2, 0]} scale={1.0} />
      </Suspense>
      <ChessboardFloor size={20} divisions={16} />
      {/* Render FollowCamera unconditionally; it checks modelRef internally */}
      <FollowCamera modelRef={modelRef} /> 
      <OrbitControls />
    </Canvas>
    </div>
  );
}

useGLTF.preload('/model.glb');
useGLTF.preload('/Idle.glb');
useGLTF.preload('/Kicking.glb'); 
useGLTF.preload('/Swing Dancing.glb'); 
