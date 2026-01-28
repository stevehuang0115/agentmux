global.self = global;
global.window = global;
global.document = { createElementNS: () => ({}) };
global.navigator = { userAgent: '' };
global.XMLHttpRequest = class {};

const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const fs = require('fs');

function inspectGlb(name, path) {
  const buffer = fs.readFileSync(path);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.parse(arrayBuffer, '', (gltf) => {
      console.log('=== ' + name + ' ===');
      function dumpNode(node, depth) {
        if (depth > 3) return;
        const prefix = '  '.repeat(depth);
        let info = prefix + node.type + ': ' + node.name;
        const p = node.position;
        if (p && (Math.abs(p.x) > 0.001 || Math.abs(p.y) > 0.001 || Math.abs(p.z) > 0.001)) {
          info += ' pos=(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ',' + p.z.toFixed(2) + ')';
        }
        const s = node.scale;
        if (s && (Math.abs(s.x - 1) > 0.001 || Math.abs(s.y - 1) > 0.001 || Math.abs(s.z - 1) > 0.001)) {
          info += ' scale=(' + s.x.toFixed(4) + ',' + s.y.toFixed(4) + ',' + s.z.toFixed(4) + ')';
        }
        if (node.type === 'SkinnedMesh' || node.type === 'Mesh') {
          const geom = node.geometry;
          if (geom) {
            geom.computeBoundingBox();
            const bb = geom.boundingBox;
            info += ' bbox=(' + bb.min.x.toFixed(1) + ',' + bb.min.y.toFixed(1) + ',' + bb.min.z.toFixed(1) + ')->(' + bb.max.x.toFixed(1) + ',' + bb.max.y.toFixed(1) + ',' + bb.max.z.toFixed(1) + ')';
          }
          if (node.type === 'SkinnedMesh' && node.skeleton) {
            info += ' bones=' + node.skeleton.bones.length;
          }
        }
        console.log(info);
        for (const child of node.children) {
          dumpNode(child, depth + 1);
        }
      }
      dumpNode(gltf.scene, 0);
      console.log('');
      resolve();
    }, (err) => {
      console.log('Error: ' + err);
      resolve();
    });
  });
}

(async () => {
  await inspectGlb('stevejobs (ref)', 'public/models/stevejobs/model.glb');
  await inspectGlb('elonmusk', 'public/models/elonmusk/model.glb');
  await inspectGlb('markzuckerberg', 'public/models/markzuckerberg/model.glb');
  await inspectGlb('jensenhuang', 'public/models/jensenhuang/model.glb');
  await inspectGlb('stevehuang', 'public/models/stevehuang/model.glb');
})();
