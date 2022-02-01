import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers} from 'app';
import Simplex from './simplex-noise.js';
import alea from './alea.js';
import metaversefile from 'metaversefile';
const {useFrame, useLocalPlayer, useLoaders, useUi, usePhysics, useCleanup} = metaversefile;


const {gltfLoader} = useLoaders();

const textureLoader = new THREE.TextureLoader();

function _makePromise() {
  let accept, reject;
  const p = new Promise((a, r) => {
    accept = a;
    reject = r;
  });
  p.accept = accept;
  p.reject = reject;
  return p;
}

export default () => {
  const physics = usePhysics();

  const object = new THREE.Object3D();
  const loadPromises = [];
  const physicsIds = [];

  class MultiSimplex {
    constructor(seed, octaves) {
      const simplexes = Array(octaves);
      for (let i = 0; i < octaves; i++) {
        simplexes[i] = new Simplex(seed + i);
      }
      this.simplexes = simplexes;
    }
    noise2D(x, z) {
      let result = 0;
      for (let i = 0; i < this.simplexes.length; i++) {
        const simplex = this.simplexes[i];
        result += simplex.noise2D(x * (2**i), z * (2**i));
      }
      // result /= this.simplexes.length;
      return result;
    }
  }

  const terrainSimplex = new MultiSimplex('lol3', 6);

  const w = 4;
  const stacksBoundingBox = new THREE.Box2(
    new THREE.Vector2(5, 0),
    new THREE.Vector2(105, 100),
  );

  const stacksMesh = (() => {
    const object = new THREE.Object3D();

    const w = 4;

    {
      const width = stacksBoundingBox.max.x - stacksBoundingBox.min.x;
      const depth = stacksBoundingBox.max.y - stacksBoundingBox.min.y;
      const center = stacksBoundingBox.min.clone().add(stacksBoundingBox.max).divideScalar(2);
      const terrainMesh = (() => {
        const geometry = (() => {
          // const s = 300;
          // const maxManhattanDistance = localVector2D.set(0, 0).manhattanDistanceTo(localVector2D2.set(s/2, s/2));

          let geometry = new THREE.PlaneBufferGeometry(width, depth, width, depth)
            .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0))))
            .applyMatrix4(new THREE.Matrix4().makeTranslation(center.x, 0, center.y));

          for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
            const x = geometry.attributes.position.array[i];
            const z = geometry.attributes.position.array[i+2];
            const d = Math.abs(x); 
            const f = Math.min(Math.max((d - 5) / 30, 0), 1)**2;
            const y = Math.min((10 + terrainSimplex.noise2D(x/500, z/500) * 10) * f, 100);
            // console.log('got distance', z, d/maxDistance);
            geometry.attributes.position.array[i+1] = y;
          }
          for (let i = 0; i < geometry.attributes.uv.array.length; i += 2) {
            geometry.attributes.uv.array[i] *= width;
            geometry.attributes.uv.array[i+1] *= depth;
          }
          
          geometry.computeVertexNormals();

          geometry = geometry.toNonIndexed();

          return geometry;
        })();

        const prefix = 'Vol_21_4';

        const diffuse1Promise = _makePromise();
        const diffuse1 = textureLoader.load(`https://webaverse.github.io/street-assets/textures/${prefix}_Base_Color.jpg`, diffuse1Promise.accept);
        diffuse1.wrapS = THREE.RepeatWrapping;
        diffuse1.wrapT = THREE.RepeatWrapping;
        diffuse1.anisotropy = 16;
        loadPromises.push(diffuse1Promise);

        const normal1Promise = _makePromise();
        const normal1 = textureLoader.load(`https://webaverse.github.io/street-assets/textures/${prefix}_Normal.jpg`, normal1Promise.accept);
        normal1.wrapS = THREE.RepeatWrapping;
        normal1.wrapT = THREE.RepeatWrapping;
        normal1.anisotropy = 16;
        loadPromises.push(normal1Promise);

        const material = new THREE.ShaderMaterial({
          uniforms: {
            uDiffuse1: {
              type: 't',
              value: diffuse1,
            },
            uNormal1: {
              type: 't',
              value: normal1,
            },
          },
          vertexShader: `\
            ${THREE.ShaderChunk.common}
            ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            attribute float y;
            attribute vec3 barycentric;
            // attribute float dynamicPositionY;
            // uniform float uBeat2;
            varying vec3 vNormal;
            varying vec2 vUv;
            // varying vec3 vBarycentric;
            varying vec3 vPosition;

            void main() {
              vUv = uv / 4.;
              vNormal = normal;
              // vBarycentric = barycentric;
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

              ${THREE.ShaderChunk.logdepthbuf_vertex}
            }
          `,
          fragmentShader: `\
            precision highp float;
            precision highp int;

            uniform sampler2D uDiffuse1;
            uniform sampler2D uNormal1;

            // varying vec3 vBarycentric;
            varying vec3 vPosition;
            varying vec2 vUv;
            varying vec3 vNormal;

            const vec3 lineColor1 = vec3(${new THREE.Color(0x66bb6a).toArray().join(', ')});
            const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

            ${THREE.ShaderChunk.logdepthbuf_pars_fragment}

            float edgeFactor(vec3 bary, float width) {
              // vec3 bary = vec3(vBC.x, vBC.y, 1.0 - vBC.x - vBC.y);
              vec3 d = fwidth(bary);
              vec3 a3 = smoothstep(d * (width - 0.5), d * (width + 0.5), bary);
              return min(min(a3.x, a3.y), a3.z);
            }

            void main() {
              // vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
              vec3 c = texture2D(uDiffuse1, vUv).rgb;
              vec3 n = texture2D(uNormal1, vUv).rgb * vNormal;
              vec3 l = normalize(vec3(-1., -2., -3.));
              c *= 0.5 + abs(dot(n, l));
              // c.rb += vUv;
              // vec3 p = fwidth(vPosition);
              // vec3 p = vPosition;
              c += vPosition.y / 30.;
              gl_FragColor = vec4(c, 1.);

              ${THREE.ShaderChunk.logdepthbuf_fragment}
            }
          `,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
      })();
      // terrainMesh.position.set(center.x, 0, center.y);
      object.add(terrainMesh);
      const physicsId = physics.addGeometry(terrainMesh);
      physicsIds.push(physicsId);
    }

    return object;
  })();
  object.add(stacksMesh);
  
  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  });
  
  return object;
};
