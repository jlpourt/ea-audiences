"use client";

/**
 * <ParticleField /> Hero atmosphere for the Home landing.
 *
 * A field of ~10-22k soft points that breathe on slow simplex-noise tides, in a
 * black → deep crimson → 2K red gradient. The cursor parts the field like a hand
 * through water: nearby points push outward and swirl, brighten toward red and
 * grow slightly; cursor speed adds energy that decays smoothly. A click sends a
 * single expanding ripple.
 *
 * Why it may animate: rare, first-impression surface (landing hero), purpose is
 * delight/atmosphere. It never sits over data: cards have solid surfaces and the
 * field fades out under the fold via a mask.
 *
 * Performance: one draw call (THREE.Points + ShaderMaterial), all motion on the
 * GPU, DPR capped at 1.5, paused when off-screen, the tab is hidden, or the Home
 * scene is exiting; GL context released on unmount. Never put this under a CSS
 * filter (forces a per-frame GPU readback). Reduced
 * motion renders a single static frame with no cursor tracking.
 * Theming: colors come from the design tokens (--accent, --bg) and re-read when
 * `data-theme` changes; additive blending on dark, normal blending on light.
 */
import { useEffect, useRef } from "react";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uEnergy;
  uniform float uAspect;
  uniform float uDpr;
  uniform vec3 uRipple;      // xy = center, z = start time (seconds, <0 = none)
  attribute float aSeed;
  varying float vHeat;
  varying float vAlpha;
  varying float vTone;

  // Ashima 3D simplex noise (MIT)
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main() {
    vec3 p = position;
    float t = uTime * 0.06;

    // Slow tides: two octaves of noise drift the field and set its tone.
    float n1 = snoise(vec3(p.xy * 0.9, t));
    float n2 = snoise(vec3(p.xy * 2.3 + 7.0, t * 1.7));
    float tide = n1 * 0.75 + n2 * 0.25;
    p.xy += vec2(snoise(vec3(p.xy * 0.7, t + 11.0)), snoise(vec3(p.xy * 0.7, t + 23.0))) * 0.045;

    // Cursor: push outward + swirl, strength scaled by recent cursor energy.
    vec2 toP = p.xy - uMouse;
    float d = length(toP);
    float r = 0.32 + uEnergy * 0.14;
    float f = exp(-(d * d) / (r * r));
    vec2 dir = d > 1e-4 ? toP / d : vec2(0.0);
    vec2 swirl = vec2(-dir.y, dir.x);
    p.xy += dir * f * (0.085 + 0.1 * uEnergy) + swirl * f * 0.045 * (0.6 + aSeed);

    // Click ripple: one expanding ring that fades out.
    float rippleHeat = 0.0;
    if (uRipple.z >= 0.0) {
      float age = uTime - uRipple.z;
      float radius = age * 0.9;
      float ring = exp(-pow((length(p.xy - uRipple.xy) - radius) * 9.0, 2.0)) * exp(-age * 1.6);
      p.xy += normalize(p.xy - uRipple.xy + 1e-4) * ring * 0.035;
      rippleHeat = ring;
    }

    // Vignette: fade toward the edges and the bottom so it melts into the page.
    float edge = smoothstep(1.6, 0.55, length(vec2(p.x / (uAspect * 1.1), p.y * 1.05 + 0.05)));

    vTone = clamp(tide * 0.5 + 0.5, 0.0, 1.0);
    vHeat = clamp(f * (0.65 + 0.5 * uEnergy) + rippleHeat, 0.0, 1.0);
    vAlpha = edge * (0.42 + 0.75 * vTone * vTone + 0.95 * vHeat) * (0.6 + 0.4 * aSeed);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.5 + 1.9 * aSeed * aSeed + 3.2 * vHeat + 1.1 * vTone) * uDpr;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uBase;     // darkest tone
  uniform vec3 uDeep;     // deep crimson
  uniform vec3 uAccent;   // 2K red
  uniform vec3 uHot;      // cursor highlight
  varying float vHeat;
  varying float vAlpha;
  varying float vTone;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float disc = smoothstep(0.5, 0.0, r);          // soft round point
    vec3 col = mix(uBase, uDeep, smoothstep(0.15, 0.6, vTone));
    col = mix(col, uAccent, smoothstep(0.5, 0.95, vTone) * 0.7);
    col = mix(col, uAccent, vHeat * 0.8);
    col = mix(col, uHot, vHeat * vHeat * 0.6);
    gl_FragColor = vec4(col, disc * vAlpha);
  }
`;

function cssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function ParticleField({ className, active = true }: { className?: string; active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Read inside the rAF loop: false while the Home scene is exiting, so the
  // field stops drawing the moment the user navigates away.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Soft points don't need full retina resolution; 1.5x keeps the canvas light.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(dpr);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(10, 10) },
        uEnergy: { value: 0 },
        uAspect: { value: 1 },
        uDpr: { value: dpr },
        uRipple: { value: new THREE.Vector3(0, 0, -1) },
        uBase: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uHot: { value: new THREE.Color() },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
      });

      const applyTheme = () => {
        const light = document.documentElement.getAttribute("data-theme") === "light";
        const accent = new THREE.Color(cssColor("--accent", "#E4002B"));
        if (light) {
          uniforms.uBase.value.set("#c9c9cf");
          uniforms.uDeep.value.copy(accent).lerp(new THREE.Color("#2a0a10"), 0.55);
          uniforms.uAccent.value.copy(accent);
          uniforms.uHot.value.copy(accent).lerp(new THREE.Color("#000000"), 0.15);
          material.blending = THREE.NormalBlending;
        } else {
          uniforms.uBase.value.set("#3a3a46");
          uniforms.uDeep.value.copy(accent).lerp(new THREE.Color("#0a0a0d"), 0.45);
          uniforms.uAccent.value.copy(accent);
          uniforms.uHot.value.copy(accent).lerp(new THREE.Color("#ffd2d8"), 0.35);
          material.blending = THREE.AdditiveBlending;
        }
        material.needsUpdate = true;
      };
      applyTheme();

      let points: InstanceType<typeof THREE.Points> | null = null;
      let w = 1;
      let h = 1;

      const build = () => {
        const rect = host.getBoundingClientRect();
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        renderer.setSize(w, h, false);
        const aspect = w / h;
        camera.left = -aspect;
        camera.right = aspect;
        camera.top = 1;
        camera.bottom = -1;
        camera.updateProjectionMatrix();
        uniforms.uAspect.value = aspect;

        const count = Math.round(Math.min(44000, Math.max(12000, (w * h) / 55)));
        const pos = new Float32Array(count * 3);
        const seed = new Float32Array(count);
        // Jittered grid: even coverage without visible rows.
        const cols = Math.ceil(Math.sqrt(count * aspect));
        const rows = Math.ceil(count / cols);
        let k = 0;
        for (let j = 0; j < rows && k < count; j++) {
          for (let i = 0; i < cols && k < count; i++, k++) {
            const x = ((i + Math.random()) / cols) * 2 - 1;
            const y = ((j + Math.random()) / rows) * 2 - 1;
            pos[k * 3] = x * aspect * 1.08;
            pos[k * 3 + 1] = y * 1.08;
            pos[k * 3 + 2] = 0;
            seed[k] = Math.random();
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
        if (points) {
          points.geometry.dispose();
          points.geometry = geo;
        } else {
          points = new THREE.Points(geo, material);
          points.frustumCulled = false;
          scene.add(points);
        }
      };
      build();

      // Cursor (window-level so it works over cards), smoothed in JS.
      const target = new THREE.Vector2(10, 10);
      let lastX = 0;
      let lastY = 0;
      let energy = 0;
      const toWorld = (cx: number, cy: number) => {
        const rect = host.getBoundingClientRect();
        const nx = ((cx - rect.left) / rect.width) * 2 - 1;
        const ny = -(((cy - rect.top) / rect.height) * 2 - 1);
        return new THREE.Vector2(nx * (rect.width / rect.height), ny);
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const p = toWorld(e.clientX, e.clientY);
        const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
        energy = Math.min(1, energy + speed / 260);
        if (uniforms.uMouse.value.x > 5) uniforms.uMouse.value.copy(p); // first contact: no sweep in
        target.copy(p);
      };
      const onLeave = () => target.set(10, 10);
      const onDown = (e: PointerEvent) => {
        const p = toWorld(e.clientX, e.clientY);
        const rect = host.getBoundingClientRect();
        if (e.clientY > rect.bottom) return;
        uniforms.uRipple.value.set(p.x, p.y, uniforms.uTime.value);
      };

      // Visibility: pause off-screen / hidden tab.
      let visible = true;
      const io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
      });
      io.observe(host);

      const ro = new ResizeObserver(() => {
        build();
        if (reduce) renderer.render(scene, camera);
      });
      ro.observe(host);

      const mo = new MutationObserver(() => {
        applyTheme();
        if (reduce) renderer.render(scene, camera);
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      let raf = 0;
      const clock = new THREE.Clock();
      if (reduce) {
        uniforms.uTime.value = 12;
        renderer.render(scene, camera);
      } else {
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerdown", onDown, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (!visible || document.hidden || !activeRef.current) {
            clock.getDelta();
            return;
          }
          const dt = Math.min(0.05, clock.getDelta());
          uniforms.uTime.value += dt;
          // Critically-damped-ish follow for the cursor, exponential energy decay.
          const follow = 1 - Math.exp(-dt * 9);
          uniforms.uMouse.value.lerp(target, follow);
          energy *= Math.exp(-dt * 1.8);
          uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * (1 - Math.exp(-dt * 6));
          renderer.render(scene, camera);
        };
        tick();
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        io.disconnect();
        ro.disconnect();
        mo.disconnect();
        points?.geometry.dispose();
        material.dispose();
        renderer.dispose();
        // Release the GL context now instead of waiting for GC, so revisiting
        // Home never accumulates contexts.
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className={`pointer-events-none ${className ?? ""}`} />;
}

export default ParticleField;
