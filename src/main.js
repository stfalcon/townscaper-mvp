import { Renderer } from './renderer.js';

const canvas = document.getElementById('canvas');
if (!canvas) throw new Error('Canvas element #canvas not found');

const renderer = new Renderer(canvas);
renderer.start();

const params = new URLSearchParams(window.location.search);
if (params.has('dev')) {
  loadDevTools(renderer);
}

function loadDevTools(r) {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js';
  s.onload = () => {
    const stats = new window.Stats();
    stats.showPanel(0);
    stats.dom.style.cssText = 'position:fixed;top:8px;left:8px;z-index:100';
    document.body.appendChild(stats.dom);

    const origRender = r.render.bind(r);
    r.render = () => {
      stats.begin();
      origRender();
      stats.end();
    };
  };
  document.head.appendChild(s);
}
