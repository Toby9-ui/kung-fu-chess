import React, { Suspense, useRef, useEffect, useState, forwardRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import ChessboardFloor from './ChessboardFloor'; // Added back missing import

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
    if (mixer) mixer.timeScale = 1;
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
    console.log('[AnimEffect Debug] Proceeding to Idle/Move logic.'); 
    let newActionToPlay = null;
    if (isMoving && moveAction) {
      newActionToPlay = moveAction;
    } else if (idleAction) {
      newActionToPlay = idleAction;
    } else {
      if (Object.values(actions).length > 0 && !idleAction) {
        console.warn("[AnimEffect] Idle action not found, trying first available action for idle.");
        newActionToPlay = Object.values(actions)[0];
      } else {
        console.warn('[AnimEffect] No suitable idle or move animation found, and no fallback available.');
      }
    }

    if (newActionToPlay) {
      if (currentAction.current !== newActionToPlay) {
        const oldActionName = currentAction.current ? currentAction.current.getClip().name : 'null';
        console.log(`[AnimEffect] Switching action. Old: '${oldActionName}' New: '${newActionToPlay.getClip().name}'`);
        if (currentAction.current) {
          currentAction.current.fadeOut(0.5);
        }
        newActionToPlay.reset().fadeIn(0.5).play();
        currentAction.current = newActionToPlay;
      }
    } else {
      if (currentAction.current) {
        console.log('[AnimEffect] No new action to play, fading out current action:', currentAction.current.getClip().name);
        currentAction.current.fadeOut(0.5);
        currentAction.current = null;
      }
    }
  }, [isMoving, actions, mixer, triggerAnimationEffect, IDLE_ANIM_NAME, MOVEMENT_ANIM_NAME, ATTACK_ANIM_NAME, EMOTE_ANIM_NAME]);

  useFrame((state, delta) => {
    const moveDirection = new THREE.Vector3();
    let currentlyMoving = false;

    if (keysPressed.current['w']) { moveDirection.z -= 1; currentlyMoving = true; }
    if (keysPressed.current['s']) { moveDirection.z += 1; currentlyMoving = true; }
    if (keysPressed.current['a']) { moveDirection.x -= 1; currentlyMoving = true; }
    if (keysPressed.current['d']) { moveDirection.x += 1; currentlyMoving = true; }

    if (modelRef && modelRef.current && currentlyMoving) {
      // Calculate direction based on camera
      const cameraDirection = new THREE.Vector3();
      state.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0; // Keep movement horizontal
      cameraDirection.normalize();

      const right = new THREE.Vector3().crossVectors(state.camera.up, cameraDirection).normalize();
      
      const finalMove = new THREE.Vector3();
      if (keysPressed.current['w']) finalMove.add(cameraDirection);
      if (keysPressed.current['s']) finalMove.sub(cameraDirection);
      if (keysPressed.current['a']) finalMove.sub(right);
      if (keysPressed.current['d']) finalMove.add(right);

      finalMove.normalize().multiplyScalar(moveSpeed);
      modelRef.current.position.add(finalMove);

      // Rotate model to face movement direction
      if (finalMove.lengthSq() > 0.001) { // Check if there is significant movement
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), finalMove.clone().normalize());
        modelRef.current.quaternion.slerp(targetQuaternion, 0.15);
      }
    }
    
    // Update isMoving state only if it changes
    setIsMoving(prevIsMoving => {
      if (prevIsMoving !== currentlyMoving) {
        // console.log(`[useFrame] isMoving changing from ${prevIsMoving} to ${currentlyMoving}`);
        return currentlyMoving;
      }
      return prevIsMoving;
    });

    if (mixer) mixer.update(delta);
  });

  return <primitive ref={ref} object={modelScene} {...props} scale={props.scale || 1} />;
});
Model.displayName = 'Model';

// --- Define constants for the follow camera --- 
const CAMERA_LOCAL_OFFSET = new THREE.Vector3(0, 2.5, -5); // (X, Y_Height, Z_Distance_Behind_Model)
const CAMERA_LOOK_AT_OFFSET = new THREE.Vector3(0, 1.5, 0); // Offset from model's origin to look at (e.g., torso)
const CAMERA_SMOOTH_SPEED = 7; // Larger is faster
// ----------------------------------------------------------

// --- FollowCamera Component --- 
function FollowCamera({ modelRef }) {
  const { camera } = useThree();

  // Set initial camera position and lookAt target
  useEffect(() => {
    if (modelRef.current) {
      const modelPosition = new THREE.Vector3();
      modelRef.current.getWorldPosition(modelPosition);

      const initialWorldOffset = CAMERA_LOCAL_OFFSET.clone().applyQuaternion(modelRef.current.quaternion);
      const initialCameraPosition = new THREE.Vector3().addVectors(modelPosition, initialWorldOffset);
      camera.position.copy(initialCameraPosition);

      const initialLookAtTarget = modelPosition.clone().add(CAMERA_LOOK_AT_OFFSET);
      camera.lookAt(initialLookAtTarget);
    }
  }, [modelRef, camera]); // Effect runs when modelRef or camera instance changes

  useFrame((state, delta) => {
    if (modelRef.current) {
      const modelPosition = new THREE.Vector3();
      modelRef.current.getWorldPosition(modelPosition); // Get model's current world position

      // Calculate desired camera position (behind the model, considering its rotation)
      const worldOffset = CAMERA_LOCAL_OFFSET.clone().applyQuaternion(modelRef.current.quaternion);
      const desiredCameraPosition = new THREE.Vector3().addVectors(modelPosition, worldOffset);

      // Calculate desired look-at target (e.g., model's torso)
      const desiredLookAtTarget = modelPosition.clone().add(CAMERA_LOOK_AT_OFFSET);

      // Smoothly interpolate camera's position
      const lerpFactor = 1.0 - Math.exp(-CAMERA_SMOOTH_SPEED * delta);
      state.camera.position.lerp(desiredCameraPosition, lerpFactor);

      // Make camera look at the target
      // For smoother lookAt, one could lerp a temporary lookAt vector, but direct lookAt is often fine.
      state.camera.lookAt(desiredLookAtTarget);
    }
  });

  return null; // This component does not render any visible elements
}
// ----------------------------------------------------------

export default function App() {
  const modelRef = useRef();
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <Canvas 
        shadows 
        camera={{ position: [0, 2.5, -5], fov: 50 }} // Adjusted initial camera for follow-cam style
        style={{ background: '#202020' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <Suspense fallback={null}>
          <Model ref={modelRef} />
          <ChessboardFloor size={50} />
        </Suspense>
        <FollowCamera modelRef={modelRef} /> {/* Added FollowCamera */}
      </Canvas>
    </div>
  );
}

useGLTF.preload('/model.glb');
useGLTF.preload('/Idle.glb');
useGLTF.preload('/Kicking.glb'); // Preload attack animation
useGLTF.preload('/Swing Dancing.glb'); // Preload emote animation
