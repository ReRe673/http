import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ProjectGalleryCanvas({ projects, progressRef, pointerRef, invalidateRef, onFailure }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      onFailure?.();
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 30);
    camera.position.z = 6.6;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(4.15, 2.334);
    const loader = new THREE.TextureLoader();
    let start = () => {};
    const planes = projects.map(project => {
      const texture = loader.load(`/previews/project-${project.id}.webp`, () => start());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return { mesh, material, texture };
    });

    let frame = 0; let current = progressRef.current; let previous = current; let velocity = 0; let pageVisible = !document.hidden;
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const draw = () => {
      frame = 0;
      const target = progressRef.current;
      current += (target - current) * .11;
      velocity += ((current - previous) - velocity) * .2;
      previous = current;
      const baseX = 1.75;
      const pointer = pointerRef.current;
      let maxMaterialDelta = 0;
      planes.forEach(({ mesh, material }, index) => {
          const delta = index - current;
          const distance = Math.abs(delta);
          const activeInfluence = Math.max(0, 1 - distance);
          mesh.position.x = baseX + Math.sin(delta * .72) * .48 + pointer.x * .16 * activeInfluence;
          mesh.position.y = -delta * 2.52 + pointer.y * .12 * activeInfluence;
          mesh.position.z = -distance * .78;
          mesh.rotation.x = delta * -.1 + pointer.y * -.045 * activeInfluence;
          mesh.rotation.y = delta * .07 + pointer.x * .055 * activeInfluence;
          mesh.rotation.z = delta * -.075 - velocity * 2.4;
          const scale = 1 - Math.min(distance, 1) * .12;
          mesh.scale.setScalar(scale);
          const targetOpacity = distance < 1.65 ? Math.max(.12, 1 - distance * .55) : 0;
          maxMaterialDelta = Math.max(maxMaterialDelta, Math.abs(targetOpacity - material.opacity));
          material.opacity += (targetOpacity - material.opacity) * .12;
      });
      renderer.render(scene, camera);
      const unsettled = Math.abs(target - current) > .001 || Math.abs(velocity) > .0005 || maxMaterialDelta > .002;
      if (unsettled) frame = requestAnimationFrame(draw);
    };
    start = () => { if (!frame && pageVisible) frame = requestAnimationFrame(draw); };
    invalidateRef.current = start;
    const onResize = () => { resize(); start(); };
    const visibility = () => {
      pageVisible = !document.hidden;
      if (!pageVisible) { cancelAnimationFrame(frame); frame = 0; }
      else start();
    };
    resize(); window.addEventListener('resize', onResize); document.addEventListener('visibilitychange', visibility); start();
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', visibility);
      if (invalidateRef.current === start) invalidateRef.current = null;
      planes.forEach(({ material, texture }) => { material.dispose(); texture.dispose(); });
      geometry.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [invalidateRef, onFailure, pointerRef, progressRef, projects]);

  return <div ref={mountRef} className="project-gallery__canvas" aria-hidden="true" />;
}
