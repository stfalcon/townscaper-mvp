import * as THREE from 'three';
import { GRID_SIZE, CAMERA, PALETTE } from './constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyTop);

    this.#setupCamera();
    this.#setupLights();
    this.#setupGround();

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#resize();
    this.onResize = () => this.#resize();
    window.addEventListener('resize', this.onResize);
  }

  #setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const v = CAMERA.viewSize;
    this.camera = new THREE.OrthographicCamera(
      -v * aspect, v * aspect,
      v, -v,
      0.1, 1000,
    );

    const d = CAMERA.distance;
    const center = GRID_SIZE / 2;
    this.camera.position.set(
      center + d * Math.cos(CAMERA.yaw) * Math.cos(CAMERA.pitch),
      d * Math.sin(CAMERA.pitch),
      center + d * Math.sin(CAMERA.yaw) * Math.cos(CAMERA.pitch),
    );
    this.camera.lookAt(center, 0, center);
  }

  #setupLights() {
    const ambient = new THREE.AmbientLight(PALETTE.lightAmbient, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(PALETTE.lightDirectional, 0.9);
    directional.position.set(5, 10, 3);
    this.scene.add(directional);

    const hemi = new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.grass, 0.4);
    this.scene.add(hemi);
  }

  #setupGround() {
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    this.scene.add(ground);
  }

  #resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const v = CAMERA.viewSize;
    this.camera.left = -v * aspect;
    this.camera.right = v * aspect;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(w, h, false);
  }

  render() {
    this.webgl.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      this.render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this.onResize);
    this.webgl.dispose();
  }
}
