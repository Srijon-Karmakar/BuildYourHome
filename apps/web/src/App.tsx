import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';

/** P0-01 hello-cube: proves the React + R3F + Vite pipeline works. Replaced in later tasks. */
export function App() {
  return (
    <Canvas shadows camera={{ position: [3, 2.5, 4], fov: 50 }} frameloop="demand">
      <color attach="background" args={['#1b1e24']} />
      <Environment preset="apartment" />
      <directionalLight position={[3, 5, 2]} intensity={1} castShadow />
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d9a066" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.9} />
      </mesh>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
