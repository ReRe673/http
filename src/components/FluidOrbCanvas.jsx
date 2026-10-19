import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0; float amplitude = 0.52; mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
    for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p = rotation * p * 2.03 + 13.17; amplitude *= 0.48; }
    return value;
  }
  void main() {
    vec2 p = vUv - 0.5; p.x *= uResolution.x / max(uResolution.y, 1.0);
    float time = uTime * 0.13; vec2 pointer = (uPointer - 0.5) * 0.1;
    float warpA = fbm(p * 2.2 + vec2(time, -time * 0.7));
    float warpB = fbm(p * 3.1 + vec2(-time * 0.55, time) + warpA);
    vec2 warped = p + pointer + vec2(warpA - 0.5, warpB - 0.5) * 0.23;
    float distanceField = length(warped) + fbm(warped * 4.0 - time) * 0.16;
    float mask = smoothstep(0.63, 0.54, distanceField);
    float ribbons = fbm(warped * 5.2 + vec2(time * 1.3, -time)) + sin((warped.x - warped.y) * 13.0 + time * 4.0) * 0.09;
    vec3 color = mix(vec3(0.48, 0.40, 0.88), vec3(0.15, 0.82, 0.94), smoothstep(0.2, 0.95, ribbons + vUv.y * 0.3));
    color += pow(max(0.0, 1.0 - distanceField), 3.0) * vec3(0.08, 0.16, 0.2);
    float edgeFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x)
      * smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
    gl_FragColor = vec4(color, mask * edgeFade * 0.9);
  }
`;

export default function FluidOrbCanvas() {
  const mountRef = useRef(null);
  useEffect(() => {
    if (!mountRef.current) return undefined;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    mount.appendChild(renderer.domElement);
    const uniforms = { uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) }, uPointer: { value: new THREE.Vector2(0.5, 0.5) } };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    let frame = 0; let visible = false; let activeUntil = 0; let lastRender = 0;
    const startedAt = performance.now();
    const resize = () => { const { width, height } = mount.getBoundingClientRect(); renderer.setSize(width, height, false); uniforms.uResolution.value.set(width, height); };
    const draw = now => {
      frame = 0;
      if (!visible) return;
      if (now - lastRender >= 32) { uniforms.uTime.value = (now - startedAt) / 1000; renderer.render(scene, camera); lastRender = now; }
      if (now < activeUntil) frame = requestAnimationFrame(draw);
    };
    const wake = (duration = 700) => {
      if (!visible) return;
      activeUntil = Math.max(activeUntil, performance.now() + duration);
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const pointer = event => {
      if (!visible || document.hidden) return;
      const rect = mount.getBoundingClientRect();
      uniforms.uPointer.value.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height); wake(420);
    };
    const onResize = () => { resize(); wake(500); };
    const onScroll = () => wake(300);
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible && !document.hidden) wake(2200);
      else { activeUntil = 0; cancelAnimationFrame(frame); frame = 0; }
    });
    const visibility = () => {
      if (document.hidden) { activeUntil = 0; cancelAnimationFrame(frame); frame = 0; }
      else if (visible) wake(600);
    };
    resize(); observer.observe(mount);
    window.addEventListener('resize', onResize); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('pointermove', pointer, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', pointer);
      document.removeEventListener('visibilitychange', visibility);
      material.dispose(); mesh.geometry.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={mountRef} className="fluid-orb" aria-hidden="true" />;
}
