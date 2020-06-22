import React, { Suspense, useRef } from "react";
import { Canvas, useLoader, useFrame, extend } from "react-three-fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RecoilRoot, useRecoilState, useRecoilValue } from "recoil";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { TextureLoader, FontLoader } from "three";
import {
  shipPositionState,
  enemyPositionState,
  laserPositionState,
  scoreState
} from "./gameState";
import "./styles.css";

// Extend will create a react component wrapper of OrbitControls for us to use.
extend({ OrbitControls });

function Loading() {
  return (
    <mesh visible position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <sphereGeometry attach="geometry" args={[1, 16, 16]} />
      <meshStandardMaterial
        attach="material"
        color="white"
        transparent
        opacity={0.6}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Terrain() {
  const terrain = useRef();

  useFrame(() => {
    terrain.current.position.z += 0.4;
  });
  return (
    <mesh
      visible
      position={[0, -50, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      ref={terrain}
    >
      <planeBufferGeometry attach="geometry" args={[5000, 5000, 128, 128]} />
      <meshStandardMaterial
        attach="material"
        color="white"
        roughness={1}
        metalness={0}
        wireframe
      />
    </mesh>
  );
}

function ArWing() {
  const [shipPosition, setShipPosition] = useRecoilState(shipPositionState);

  const ship = useRef();
  useFrame(({ mouse }) => {
    setShipPosition({
      position: { x: mouse.x * 6, y: mouse.y * 2 },
      rotation: { z: -mouse.x * 0.5, x: -mouse.x * 0.5, y: -mouse.y * 1 }
    });
  });
  useFrame(({ mouse }) => {
    ship.current.rotation.z = shipPosition.rotation.z;
    ship.current.rotation.y = shipPosition.rotation.x;
    ship.current.rotation.x = shipPosition.rotation.y * 0.2;
    ship.current.position.y = shipPosition.position.y;
    ship.current.position.x = shipPosition.position.x;
  });

  const { nodes } = useLoader(GLTFLoader, "models/arwing.glb");

  return (
    <group ref={ship}>
      <mesh visible geometry={nodes.Default.geometry}>
        <meshStandardMaterial
          attach="material"
          color="white"
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

function Target() {
  const rearTarget = useRef();
  const frontTarget = useRef();

  const loader = new TextureLoader();
  // The CubeTextureLoader load method takes an array of urls representing all 6 sides of the cube.
  const texture = loader.load("target.png");

  // Update the position of the reticle based on the ships current position.
  useFrame(({ mouse }) => {
    rearTarget.current.position.y = -mouse.y * 10;
    rearTarget.current.position.x = -mouse.x * 30;

    frontTarget.current.position.y = -mouse.y * 20;
    frontTarget.current.position.x = -mouse.x * 60;
  });
  return (
    <group>
      <sprite position={[0, 0, -8]} ref={rearTarget}>
        <spriteMaterial
          attach="material"
          map={texture}
          color="orange"
          emissive="#ff0860"
        />
      </sprite>
      <sprite position={[0, 0, -16]} ref={frontTarget}>
        <spriteMaterial
          attach="material"
          map={texture}
          color="orange"
          emissive="#ff0860"
        />
      </sprite>
    </group>
  );
}

function Enemies() {
  const enemies = useRecoilValue(enemyPositionState);
  return (
    <group>
      {enemies.map(enemy => (
        <mesh position={[enemy.x, enemy.y, enemy.z]} key={`${enemy.x}`}>
          <sphereBufferGeometry attach="geometry" args={[2, 8, 8]} />
          <meshStandardMaterial attach="material" color="white" wireframe />
        </mesh>
      ))}
    </group>
  );
}

function LaserController() {
  const shipPosition = useRecoilValue(shipPositionState);
  const [lasers, setLasers] = useRecoilState(laserPositionState);
  return (
    <mesh
      position={[0, 0, -8]}
      onClick={() =>
        setLasers([
          ...lasers,
          {
            id: Math.random(),
            x: 0,
            y: 0,
            z: 0,
            velocity: [shipPosition.rotation.x, shipPosition.rotation.y]
          }
        ])
      }
    >
      <planeBufferGeometry attach="geometry" args={[100, 100]} />
      <meshStandardMaterial
        attach="material"
        color="orange"
        emissive="#ff0860"
        visible={false}
      />
    </mesh>
  );
}

function Lasers() {
  const lasers = useRecoilValue(laserPositionState);
  return (
    <group>
      {lasers.map(laser => (
        <mesh position={[laser.x, laser.y, laser.z]} key={`${laser.id}`}>
          <boxBufferGeometry attach="geometry" args={[1, 1, 1]} />
          <meshStandardMaterial attach="material" emissive="white" wireframe />
        </mesh>
      ))}
    </group>
  );
}

// This component runs game logic on each frame draw to update game state.
function GameTimer() {
  const [enemies, setEnemies] = useRecoilState(enemyPositionState);
  const [lasers, setLaserPositions] = useRecoilState(laserPositionState);
  const [score, setScore] = useRecoilState(scoreState);

  useFrame(({ mouse }) => {
    // Calculate hits and remove lasers and enemies, increase score.

    const hitEnemies = enemies
      ? enemies.map(
          enemy =>
            lasers.filter(
              laser =>
                laser.z - enemy.z < 1 &&
                laser.x - enemy.x < 1 &&
                laser.y - enemy.y < 1
            ).length > 0
        )
      : [];

    if (hitEnemies.includes(true) && enemies.length > 0) {
      setScore(score + 1);
      console.log("hit detected");
    }

    // Move all of the enemies
    setEnemies(
      enemies
        .map(enemy => ({ x: enemy.x, y: enemy.y, z: enemy.z + 0.1 }))
        .filter((enemy, idx) => !hitEnemies[idx] && enemy.z < 0)
    );
    // Move the Lasers and remove lasers at end of range.
    setLaserPositions(
      lasers
        .map(laser => ({
          id: laser.id,
          x: laser.x + laser.velocity[0] * 6,
          y: laser.y + laser.velocity[1],
          z: laser.z - 1,
          velocity: laser.velocity
        }))
        .filter(laser => laser.z > -100 && laser.y > -50)
    );
  });
  return null;
}

export default function App() {
  return (
    <>
      <Canvas style={{ background: "black" }}>
        <RecoilRoot>
          <directionalLight intensity={1} />
          <ambientLight intensity={0.1} />
          <Suspense fallback={<Loading />} />
          <Suspense fallback={<Loading />}>
            <ArWing />
          </Suspense>
          <Target />
          <Enemies />
          <Lasers />
          <Terrain />
          <LaserController />
          <GameTimer />
        </RecoilRoot>
      </Canvas>

      <a
        href="https://codeworkshop.dev/blog/2020-03-31-creating-a-3d-spacefox-scene-with-react-three-fiber/"
        className="blog-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        Blog Post
      </a>
    </>
  );
}
