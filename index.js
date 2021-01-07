import * as THREE from 'three';
import {GLTFLoader} from 'GLTFLoader';
import {BufferGeometryUtils} from 'BufferGeometryUtils';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers} from 'app';
import Simplex from './simplex-noise.js';
import alea from './alea.js';

const parcelSize = 16;
const width = 10;
const height = 10;
const depth = 10;
// const colorTargetSize = 64;
// const voxelSize = 0.1;
// const marchCubesTexSize = 2048;
// const fov = 90;
// const aspect = 1;
// const raycastNear = 0.1;
// const raycastFar = 100;
// const raycastDepth = 3;
// const walkSpeed = 0.0015;
const streetSize = new THREE.Vector3(10, 1, 1000);

const zeroVector = new THREE.Vector3(0, 0, 0);
const zeroQuaternion = new THREE.Quaternion();
const oneVector = new THREE.Vector3(1, 1, 1);
const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector2D = new THREE.Vector2();
const localQuaternion = new THREE.Quaternion();
const localEuler = new THREE.Euler();
const localMatrix = new THREE.Matrix4();
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

const rootScene = new THREE.Scene();
app.object.add(rootScene);

/* const ambientLight = new THREE.AmbientLight(0xFFFFFF);
rootScene.add(ambientLight);
// rootScene.ambientLight = ambientLight;
const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
directionalLight.position.set(1, 2, 3);
rootScene.add(directionalLight);
// rootScene.directionalLight = directionalLight; */

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

const gridSimplex = new MultiSimplex('lol', 6);
const gridSimplex2 = new MultiSimplex('lol2', 6);
const terrainSimplex = new MultiSimplex('lol3', 6);

const streetMesh = (() => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        type: 'f',
        value: 0,
      },
      /* uBeat: {
        type: 'f',
        value: 1,
      }, */
    },
    vertexShader: `\
      #define PI 3.1415926535897932384626433832795

      attribute float y;
      attribute vec3 barycentric;
      varying float vUv;
      varying vec3 vBarycentric;
      varying vec3 vPosition;
      void main() {
        vUv = uv.x;
        vBarycentric = barycentric;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `\
      // uniform float uBeat;
      varying vec3 vBarycentric;
      varying vec3 vPosition;
      uniform float uTime;

      struct C{
          float d;
          int t;
      };
          
      float rand2(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      float rand(vec3 v){
          return rand2(vec2(v.x+v.z,v.y+v.z));
      }

      int wait(float t){
          float period = 4.*3.141592/1.5;
          t = mod(t,period);
          if(t < period/2.){
              if(t < period/8.)return 0;
              if(t < period/4.)return 1;
              return int((t/period-1./4.)*40.)+2;
          }else{
              t-=period/2.;
              if(t < period/8.)return 10;
              if(t < period/4.)return 9;
              return 8-int((t/period-1./4.)*40.);
          }
          return 0;
      }

      float scal(float t){
          float period = 4.*3.141592/1.5;
          t = mod(t,period);
          float base = -1000.0;
          if(t < period/2.){
              if(t < period/8.)base=-1000.0;
              else if(t < period/4.)base=period/8.;
              else if(t<period*(1./4.+9./40.)){
                  int x = int((t/period-1./4.)*40.);
                base = period*(1./4.+float(x)/40.);
              }
          }else{
              t -= period/2.;
              if(t < period/8.)base=-1000.0;
              else if(t < period/4.)base=period/8.;
              else if(t<period*(1./4.+9./40.)){
                  int x = int((t/period-1./4.)*40.);
                base = period*(1./4.+float(x)/40.);
              }
          }
          return exp(-(t-base)*10.);
      }

      vec3 transform(vec3 p){
          float t = uTime+sin(uTime*1.5);
          p -= vec3(4,0,0);
          p *= mat3(cos(t),0,sin(t),0,1,0,-sin(t),0,cos(t));
          t *= 1.2;
          t += sin(uTime*0.5);
          p *= mat3(cos(t),sin(t),0,-sin(t),cos(t),0,0,0,1);
          return p;
      }

      float pattern(vec3 p, float section) {
        // p = transform(p);
        /* float s = 1.; // (0.7+scal(uTime)*0.08) / 0.7;
        p /= s;
        p /= 1.3;
        p += 0.5; */
        float d = 0.;
        // float t = uTime;
        vec3 e = vec3(section);
        for(int i=0;i<10;i++){
            // if(wait(t) <= i)break;
            float w = pow(2.,float(i));
            float f;

            f = rand(vec3(0,0,float(i))+e);
            if(p.x < f)e.x+=w;
            else e.x-=w;
            if(pow(max(0.,1.-abs(p.x-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

            f = rand(vec3(1,0,float(i))+e);
            if(p.y < f)e.y+=w;
            else e.y-=w;
            if(pow(max(0.,1.-abs(p.y-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;

            f = rand(vec3(2,0,float(i))+e);
            if(p.z < f)e.z+=w;
            else e.z-=w;
            if(pow(max(0.,1.-abs(p.z-f)),90.)*1.5 > 0.5+float(i)/20.)d = 1.;
        }
        return d<1.?0.:1.;
      }

      const vec3 lineColor1 = vec3(${new THREE.Color(0x4fc3f7).toArray().join(', ')});
      // const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

      void main() {
        // vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
        vec3 c = lineColor1;
        vec3 p = mod(vec3(vPosition.x*0.99, vPosition.y, vPosition.z)/10. + 0.5, 1.);
        float section = floor(vPosition.z/10.);
        float f = pattern(p, section);
        gl_FragColor = vec4(c * (f > 0.5 ? 1. : 0.2) /* * uBeat */, 1.);
      }
    `,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BoxBufferGeometry(streetSize.x, streetSize.y, streetSize.z);
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
})();
streetMesh.position.set(0, -1/2, 0);
rootScene.add(streetMesh);

const w = 4;

const popoverWidth = 600;
const popoverHeight = 200;
const popoverTarget = new THREE.Object3D();
popoverTarget.position.set(6, 2, -4);
const popoverTextMesh = (() => {
  const textMesh = ui.makeTextMesh('Multiplayer hub.\n[E] to Enter', undefined, 0.5, 'center', 'middle');
  textMesh.position.z = 0.1;
  textMesh.scale.x = popoverHeight / popoverWidth;
  textMesh.color = 0xFFFFFF;
  return textMesh;
})();
const popoverMesh = popovers.addPopover(popoverTextMesh, {
  width: popoverWidth,
  height: popoverHeight,
  target: popoverTarget,
});

/* function mod(a, n) {
  return ((a%n)+n)%n;
}
const floorMesh = (() => {
  const dims = [100, 500];
  const dims2P1 = dims.map(n => 2*n+1);
  const planeBufferGeometry = new THREE.PlaneBufferGeometry(1, 1)
    .applyMatrix4(localMatrix.makeScale(0.95, 0.95, 1))
    .applyMatrix4(localMatrix.makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
    // .applyMatrix4(localMatrix.makeTranslation(0, 0.1, 0))
    .toNonIndexed();
  const numCoords = planeBufferGeometry.attributes.position.array.length;
  const numVerts = numCoords/3;
  const positions = new Float32Array(numCoords*dims2P1[0]*dims2P1[1]);
  const centers = new Float32Array(numCoords*dims2P1[0]*dims2P1[1]);
  const typesx = new Float32Array(numVerts*dims2P1[0]*dims2P1[1]);
  const typesz = new Float32Array(numVerts*dims2P1[0]*dims2P1[1]);
  let i = 0;
  for (let x = -dims[0]; x <= dims[0]; x++) {
    for (let z = -dims[1]; z <= dims[1]; z++) {
      const newPlaneBufferGeometry = planeBufferGeometry.clone()
        .applyMatrix4(localMatrix.makeTranslation(x, 0, z));
      positions.set(newPlaneBufferGeometry.attributes.position.array, i * newPlaneBufferGeometry.attributes.position.array.length);
      for (let j = 0; j < newPlaneBufferGeometry.attributes.position.array.length/3; j++) {
        localVector.set(x, 0, z).toArray(centers, i*newPlaneBufferGeometry.attributes.position.array.length + j*3);
      }
      let typex = 0;
      if (mod((x + parcelSize/2), parcelSize) === 0) {
        typex = 1/8;
      } else if (mod((x + parcelSize/2), parcelSize) === parcelSize-1) {
        typex = 2/8;
      }
      let typez = 0;
      if (mod((z + parcelSize/2), parcelSize) === 0) {
        typez = 1/8;
      } else if (mod((z + parcelSize/2), parcelSize) === parcelSize-1) {
        typez = 2/8;
      }
      for (let j = 0; j < numVerts; j++) {
        typesx[i*numVerts + j] = typex;
        typesz[i*numVerts + j] = typez;
      }
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('typex', new THREE.BufferAttribute(typesx, 1));
  geometry.setAttribute('typez', new THREE.BufferAttribute(typesz, 1));
  const floorVsh = `
    #define PI 3.1415926535897932384626433832795
    uniform float uAnimation;
    attribute vec3 center;
    attribute float typex;
    attribute float typez;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;

    float range = 1.0;

    void main() {
      float animationRadius = uAnimation * 10.;
      float currentRadius = length(center.xz - cameraPosition.xz);
      float radiusDiff = abs(animationRadius - currentRadius);
      float height = max((range - radiusDiff)/range, 0.0);
      height = sin(height*PI/2.0);
      height *= 0.2;
      // height = 0.0;
      vec3 p = vec3(position.x, position.y + height, position.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      vPosition = position + vec3(0.5, 0.0, 0.5);
      vTypex = typex;
      vTypez = typez;
      vDepth = gl_Position.z / 30.0;
    }
  `;
  const floorFsh = `
    uniform vec4 uCurrentParcel;
    uniform vec4 uHoverParcel;
    uniform vec4 uSelectedParcel;
    uniform vec3 uSelectedColor;
    // uniform float uAnimation;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;
    void main() {
      vec3 c = vec3(${new THREE.Color(0xCCCCCC).toArray().join(', ')});
      float a = (1.0-vDepth)*0.5;
      gl_FragColor = vec4(c, a);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCurrentParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uHoverParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uSelectedParcel: {
        type: 'v4',
        value: new THREE.Vector4(-8, -8, 8, 8),
      },
      uSelectedColor: {
        type: 'c',
        value: new THREE.Color().setHex(0x5c6bc0),
      },
      uAnimation: {
        type: 'f',
        value: 0,
      },
    },
    vertexShader: floorVsh,
    fragmentShader: floorFsh,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // mesh.castShadow = true;
  // mesh.receiveShadow = true;
  return mesh;
})();
floorMesh.position.set(0, -0.02, 0);
rootScene.add(floorMesh); */

const stacksBoundingBox = new THREE.Box2(
  new THREE.Vector2(5, 0),
  new THREE.Vector2(105, 100),
);
const gridMesh = (() => {
  const geometry = (() => {
    const s = 300;
    // const maxManhattanDistance = localVector2D.set(0, 0).manhattanDistanceTo(localVector2D2.set(s/2, s/2));

    let geometry = new THREE.PlaneBufferGeometry(s, s, s, s)
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0))));

    for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
      const x = geometry.attributes.position.array[i];
      const z = geometry.attributes.position.array[i+2];
      const d = Math.abs(x); 
      const f = Math.min(Math.max((d - 5) / 30, 0), 1)**2;
      const y = -0.01 + Math.min(Math.max(gridSimplex.noise2D(x/500, z/500) * f * 30, 0), 100) * Math.min(stacksBoundingBox.distanceToPoint(new THREE.Vector2(x, z)), 1);
      // console.log('got distance', z, d/maxDistance);
      geometry.attributes.position.array[i+1] = y;
    }
    const dynamicPositionYs = new Float32Array(geometry.attributes.position.array.length/3);
    for (let i = 0; i < dynamicPositionYs.length; i += 3) {
      const x = geometry.attributes.position.array[i*3];
      const z = geometry.attributes.position.array[i*3+2];

      // const d = Math.abs(x); 
      // const f = Math.min(Math.max((d - 5) / 30, 0), 1)**2;

      const y = gridSimplex2.noise2D(x/500, z/500) * 3;
      dynamicPositionYs[i] = y;
      dynamicPositionYs[i+1] = y;
      dynamicPositionYs[i+2] = y;
    }
    geometry.setAttribute('dynamicPositionY', new THREE.BufferAttribute(dynamicPositionYs, 1));

    geometry = geometry.toNonIndexed();
    const barycentrics = new Float32Array(geometry.attributes.position.array.length);
    let barycentricIndex = 0;
    for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
      barycentrics[barycentricIndex++] = 1;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 1;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 1;
    }
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));

    return geometry;
  })();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      /* uBeat: {
        type: 'f',
        value: 1,
      },
      uBeat2: {
        type: 'f',
        value: 0,
      }, */
    },
    vertexShader: `\
      #define PI 3.1415926535897932384626433832795

      attribute float y;
      attribute vec3 barycentric;
      attribute float dynamicPositionY;
      // uniform float uBeat2;
      varying float vUv;
      varying vec3 vBarycentric;
      varying vec3 vPosition;

      void main() {
        vUv = uv.x;
        vBarycentric = barycentric;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position /* + vec3(0., dynamicPositionY * uBeat2, 0.) */, 1.0);
      }
    `,
    fragmentShader: `\
      // uniform float uBeat;
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      varying vec3 vBarycentric;
      varying vec3 vPosition;

      const vec3 lineColor1 = vec3(${new THREE.Color(0x66bb6a).toArray().join(', ')});
      const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

      float edgeFactor(vec3 bary, float width) {
        // vec3 bary = vec3(vBC.x, vBC.y, 1.0 - vBC.x - vBC.y);
        vec3 d = fwidth(bary);
        vec3 a3 = smoothstep(d * (width - 0.5), d * (width + 0.5), bary);
        return min(min(a3.x, a3.y), a3.z);
      }

      void main() {
        vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
        // vec3 p = fwidth(vPosition);
        vec3 p = vPosition;
        float f = min(mod(p.x, 1.), mod(p.z, 1.));
        f = min(f, mod(1.-p.x, 1.));
        f = min(f, mod(1.-p.z, 1.));
        f *= 10.;
        gl_FragColor = vec4(c /* * uBeat */, /*0.7 + */max(1. - f, 0.));
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
})();
// gridMesh.position.set(0, -0.01, 0);
rootScene.add(gridMesh);

const particlesMesh = (() => {
  const numParticles = 30000;
  const s = 0.1;
  const spread = 20;
  const geometry = (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(1000 * 9);
    for (let i = 0; i < positions.length; i += 9) {
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(s).toArray(positions, i);
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(s).toArray(positions, i+3);
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(s).toArray(positions, i+6);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const barycentrics = new Float32Array(positions.length);
    let barycentricIndex = 0;
    for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
      barycentrics[barycentricIndex++] = 1;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 1;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 0;
      barycentrics[barycentricIndex++] = 1;
    }
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));
    const offset = new Float32Array(positions.length);
    for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(spread);
      localVector.toArray(offset, i);
      localVector.toArray(offset, i+3);
      localVector.toArray(offset, i+6);
    }
    geometry.setAttribute('offset', new THREE.BufferAttribute(offset, 3));
    const dynamicPositions = new Float32Array(positions.length);
    for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).multiplyScalar(5);
      localVector.toArray(dynamicPositions, i);
      localVector.toArray(dynamicPositions, i+3);
      localVector.toArray(dynamicPositions, i+6);
    }
    geometry.setAttribute('dynamicPosition', new THREE.BufferAttribute(dynamicPositions, 3));
    const dynamicRotations = new Float32Array(positions.length);
    for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
      localVector.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).normalize();
      localVector.toArray(dynamicRotations, i);
      localVector.toArray(dynamicRotations, i+3);
      localVector.toArray(dynamicRotations, i+6);
    }
    geometry.setAttribute('dynamicRotation', new THREE.BufferAttribute(dynamicRotations, 3));
    const timeOffset = new Float32Array(positions.length/3);
    for (let i = 0; i < timeOffset.length; i += 3) {
      const r = Math.random();
      timeOffset[i] = r;
      timeOffset[i+1] = r;
      timeOffset[i+2] = r;
    }
    geometry.setAttribute('timeOffset', new THREE.BufferAttribute(timeOffset, 1));

    return geometry;
  })();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        type: 'f',
        value: 0,
      },
      /* uBeat: {
        type: 'f',
        value: 0,
      },
      uBeat2: {
        type: 'f',
        value: 0,
      }, */
      uTime: {
        type: 'f',
        value: 0,
      },
    },
    vertexShader: `\
      #define PI 3.1415926535897932384626433832795

      vec3 applyQuaternion(vec3 v, vec4 q) { 
        return v + 2.0*cross(cross(v, q.xyz ) + q.w*v, q.xyz);
      }
      vec4 axisAngleToQuaternion(vec3 axis, float angle) {
        float half_angle = angle/2.;
        vec4 q;
        q.x = axis.x * sin(half_angle);
        q.y = axis.y * sin(half_angle);
        q.z = axis.z * sin(half_angle);
        q.w = cos(half_angle);
        return q;
      }
      vec4 mult(vec4 a, vec4 b) {
        return a * b;
      }
      vec3 applyAxisAngle(vec3 vector, vec3 axis, float angle) {
        return applyQuaternion(vector, axisAngleToQuaternion(axis, angle));
      }

      uniform float uTime;
      // uniform float uBeat2;
      // attribute float y;
      attribute vec3 offset;
      attribute vec3 barycentric;
      attribute vec3 dynamicPosition;
      attribute vec3 dynamicRotation;
      attribute float timeOffset;
      // varying float vUv;
      varying vec3 vBarycentric;
      // varying vec3 vPosition;
      void main() {
        // vUv = uv.x;
        vBarycentric = barycentric;
        // vPosition = position;
        vec3 p = position /* * (1. + uBeat2) */;
        vec3 o = offset + dynamicPosition * mod(timeOffset + uTime, 1.);
        o -= cameraPosition;
        o = mod(o, ${spread.toFixed(8)});
        o -= ${(spread/2).toFixed(8)};
        o += cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(applyAxisAngle(p, dynamicRotation, uTime * PI*2.) + o, 1.0);
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      uniform float uColor;
      // uniform float uBeat;
      varying vec3 vBarycentric;
      // varying vec3 vPosition;

      // const vec3 lineColor1 = vec3(${new THREE.Color(0x66bb6a).toArray().join(', ')});
      // const vec3 lineColor2 = vec3(${new THREE.Color(0x9575cd).toArray().join(', ')});

      float edgeFactor(vec3 bary, float width) {
        // vec3 bary = vec3(vBC.x, vBC.y, 1.0 - vBC.x - vBC.y);
        vec3 d = fwidth(bary);
        vec3 a3 = smoothstep(d * (width - 0.5), d * (width + 0.5), bary);
        return min(min(a3.x, a3.y), a3.z);
      }

      void main() {
        // vec3 c = mix(lineColor1, lineColor2, vPosition.y / 10.);
        vec3 c = vec3(uColor);
        float f = edgeFactor(vBarycentric, 1.);
        gl_FragColor = vec4(c /* * uBeat */, max(1. - f, 0.));
        // gl_FragColor = vec4(c, 1.);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
})();
rootScene.add(particlesMesh);

const floorPhysicsId = physics.addBoxGeometry(streetMesh.position, streetMesh.quaternion, new THREE.Vector3(streetSize.z, streetSize.y, streetSize.z).multiplyScalar(0.5), false);
/* app.addEventListener('unload', () => {
  physics.removeGeometry(physicsId);
}); */

const parcelSpecs = [];
const stacksMesh = (() => {
  const object = new THREE.Object3D();

  const w = 4;

  (async () => {
    const fortniteMesh = await new Promise((accept, reject) => {
      gltfLoader.load(`https://webaverse.github.io/street-assets/fortnite.glb`, function(object) {
        object = object.scene;
        
        object.traverse(o => {
          if (o.isMesh) {
            o.material.color.setHex(0x111111);
          }
        });

        accept(object);
      }, function progress() {}, reject);
    });
    const floorMesh = fortniteMesh.getObjectByName('floor');
    const wallMesh = fortniteMesh.getObjectByName('wall');
    const rampMesh = fortniteMesh.getObjectByName('ramp');
    
    const position = new THREE.Vector3();
    // const quaternion = new THREE.Quaternion();
    const rng = alea('lol');

    // const s = 0.95;
    const floorGeometry = floorMesh.geometry.clone();
    const wallGeometry = wallMesh.geometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeScale(1, 4/3, 1));
    const rampGeometry = rampMesh.geometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeScale(1, 4/3, 1));

    const geometries = [];
    const _mergeGeometry = (g, physicsSpec) => {
      geometries.push(g);

      if (physicsSpec) {
        const {position, quaternion, scale} = physicsSpec;
        const floorPhysicsId = physics.addBoxGeometry(position, quaternion, scale, false);
      }
    };
    const _getKey = p => p.toArray().join(':');

    const numBuildings = 10;
    const seenBuildings = {};
    for (let i = 0; i < numBuildings; i++) {
      let buildingSize, buildingPosition;
      for (;;) {
        buildingSize = new THREE.Vector3(
          1 + Math.floor(rng() * 5),
          1 + Math.floor(rng() * 10),
          1 + Math.floor(rng() * 5),
        );
        buildingPosition = new THREE.Vector3(
          Math.floor(-20 + rng() * 40),
          0,
          Math.floor(-20 + rng() * 40),
        );

        const _fits = () => {
          for (let dx = 0; dx < buildingSize.x; dx++) {
            for (let dy = 0; dy < buildingSize.y; dy++) {
              for (let dz = 0; dz < buildingSize.z; dz++) {
                const ax = buildingPosition.x + dx;
                const ay = buildingPosition.y + dy;
                const az = buildingPosition.z + dz;
                const k = _getKey(new THREE.Vector3(ax, ay, az).multiplyScalar(w));
                if (!seenBuildings[k]) {
                  // nothing
                } else {
                  return false;
                }
              }
            }
          }
          return true;
        };
        const _mark = () => {
          for (let dx = 0; dx < buildingSize.x; dx++) {
            for (let dy = 0; dy < buildingSize.y; dy++) {
              for (let dz = 0; dz < buildingSize.z; dz++) {
                const ax = buildingPosition.x + dx;
                const ay = buildingPosition.y + dy;
                const az = buildingPosition.z + dz;
                const k = _getKey(new THREE.Vector3(ax, ay, az).multiplyScalar(w));
                seenBuildings[k] = true;
              }
            }
          }
        };
        const _draw = () => {
          for (let dx = 0; dx < buildingSize.x; dx++) {
            for (let dy = 0; dy < buildingSize.y; dy++) {
              const ax = buildingPosition.x + dx;
              const ay = buildingPosition.y + dy;
              const az = buildingPosition.z;

              const quaternion = new THREE.Quaternion();
              const g = wallGeometry.clone()
                .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                .applyMatrix4(new THREE.Matrix4().makeTranslation(ax * w, ay * w, az * w));
              _mergeGeometry(g, {
                position: new THREE.Vector3(ax * w, ay * w, az * w).add(new THREE.Vector3(0, 0, -w/2).applyQuaternion(quaternion)),
                quaternion,
                scale: new THREE.Vector3(w, w, 0.1).divideScalar(2),
              });
            }
            for (let dy = 0; dy < buildingSize.y; dy++) {
              const ax = buildingPosition.x + dx;
              const ay = buildingPosition.y + dy;
              const az = buildingPosition.z + buildingSize.z - 1;

              const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
              const g = wallGeometry.clone()
                .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                .applyMatrix4(new THREE.Matrix4().makeTranslation(ax * w, ay * w, az * w));
              _mergeGeometry(g, {
                position: new THREE.Vector3(ax * w, ay * w, az * w).add(new THREE.Vector3(0, 0, -w/2).applyQuaternion(quaternion)),
                quaternion,
                scale: new THREE.Vector3(w, w, 0.1).divideScalar(2),
              });
            }
          }
          for (let dz = 0; dz < buildingSize.z; dz++) {
            for (let dy = 0; dy < buildingSize.y; dy++) {
              const ax = buildingPosition.x;
              const ay = buildingPosition.y + dy;
              const az = buildingPosition.z + dz;

              const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2);
              const g = wallGeometry.clone()
                .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                .applyMatrix4(new THREE.Matrix4().makeTranslation(ax * w, ay * w, az * w));
              _mergeGeometry(g, {
                position: new THREE.Vector3(ax * w, ay * w, az * w).add(new THREE.Vector3(0, 0, -w/2).applyQuaternion(quaternion)),
                quaternion,
                scale: new THREE.Vector3(w, w, 0.1).divideScalar(2),
              });
            }
            for (let dy = 0; dy < buildingSize.y; dy++) {
              const ax = buildingPosition.x + buildingSize.x - 1;
              const ay = buildingPosition.y + dy;
              const az = buildingPosition.z + dz;

              const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2);
              const g = wallGeometry.clone()
                .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion))
                .applyMatrix4(new THREE.Matrix4().makeTranslation(ax * w, ay * w, az * w));
              _mergeGeometry(g, {
                position: new THREE.Vector3(ax * w, ay * w, az * w).add(new THREE.Vector3(0, 0, -w/2).applyQuaternion(quaternion)),
                quaternion,
                scale: new THREE.Vector3(w, w, 0.1).divideScalar(2),
              });
            }
          }

          // roof
          for (let dx = 0; dx < buildingSize.x; dx++) {
            for (let dz = 0; dz < buildingSize.z; dz++) {
              const ax = buildingPosition.x + dx;
              const ay = buildingPosition.y + buildingSize.y;
              const az = buildingPosition.z + dz;

              const g = floorGeometry.clone()
                .applyMatrix4(new THREE.Matrix4().makeTranslation(ax * w, ay * w, az * w));
              _mergeGeometry(g, {
                position: new THREE.Vector3(ax * w, ay * w, az * w),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(w, 0.1, w).divideScalar(2),
              });
            }
          }

          const r = rng();
          if (r < 0.5) {
            const parcelSpec = {
              position: new THREE.Vector3((buildingPosition.x - 0.5) * w, (buildingPosition.y + buildingSize.y) * w, (buildingPosition.z - 0.5) * w),
              size: new THREE.Vector3(buildingSize.x * w, 0, buildingSize.z * w),
            };
            parcelSpecs.push(parcelSpec);
          }
        };
        if (_fits()) {
          _mark();
          _draw();
          break;
        } else {
          continue;
        }
      }
    }

    const seenPositions = {};

    const roadLength = 30;
    let lastDirection = new THREE.Vector3();
    let lastGeometryType = 'floor';
    for (let i = 0; i < roadLength; i++) {
      if (lastGeometryType === 'floor') {
        const g = floorGeometry.clone();
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));
        _mergeGeometry(g, {
          position,
          quaternion: new THREE.Quaternion(),
          scale: new THREE.Vector3(w, 0.1, w).divideScalar(2),
        });
      } else if (lastGeometryType === 'ramp') {
        const g = rampGeometry.clone();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(lastDirection.x, 0, lastDirection.z));
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion));
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z));
        _mergeGeometry(g, {
          position: position.clone().add(new THREE.Vector3(0, w/2, 0)),
          quaternion: quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/4)),
          scale: new THREE.Vector3(w, 0.1, Math.sqrt(2*(w**2))).divideScalar(2),
        });
      }

      const k = _getKey(position);
      seenPositions[k] = lastGeometryType;

      if (lastGeometryType === 'ramp') {
        position.y += w;
      }

      for (;;) {
        let direction, geometryType;
        if (lastGeometryType === 'floor') {
          direction = (() => {
            const r = rng();
            if (r < 1/4) {
              return new THREE.Vector3(-1, 0, 0);
            } else if (r < 2/4) {
              return new THREE.Vector3(1, 0, 0);
            } else if (r < 3/4) {
              return new THREE.Vector3(0, 0, -1);
            } else {
              return new THREE.Vector3(0, 0, 1);
            }
          })();
          const r = rng();
          if (r < 0.25) {
            // direction.y += 0.5;
            geometryType = 'ramp';
          } else {
            geometryType = 'floor';
          }
        } else {
          const r = rng();
          if (r < 0.5) { // end
            direction = lastDirection.clone();
            // direction.y = 0;
            geometryType = 'floor';
          } else { // continue
            direction = lastDirection.clone();
            geometryType = 'ramp';
          }
        }
        // console.log('got direction', direction.toArray(), geometryType);

        const nextPosition = position.clone().add(direction.clone().multiplyScalar(w));
        const k = _getKey(nextPosition);
        if (!seenPositions[k] && seenPositions[_getKey(nextPosition.clone().sub(new THREE.Vector3(0, w, 0)))] !== 'ramp') {
          position.copy(nextPosition);
          lastDirection = direction;
          lastGeometryType = geometryType;
          break;
        } else {
          continue;
        }
      }
    }
    // console.log('draw range', indices, indexIndex/3);

    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
    /* geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setDrawRange(0, indexIndex); */

    /* const material = new THREE.ShaderMaterial({
      uniforms: {
      },
      vertexShader: `\
        precision highp float;
        precision highp int;

        uniform vec4 uSelectRange;

        // attribute vec3 barycentric;
        attribute float ao;
        attribute float skyLight;
        attribute float torchLight;

        varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vBarycentric;
        varying float vAo;
        varying float vSkyLight;
        varying float vTorchLight;
        varying vec3 vSelectColor;
        varying vec2 vWorldUv;
        varying vec3 vPos;
        varying vec3 vNormal;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          vViewPosition = -mvPosition.xyz;
          vUv = uv;
          // vBarycentric = barycentric;
          float vid = float(gl_VertexID);
          if (mod(vid, 3.) < 0.5) {
            vBarycentric = vec3(1., 0., 0.);
          } else if (mod(vid, 3.) < 1.5) {
            vBarycentric = vec3(0., 1., 0.);
          } else {
            vBarycentric = vec3(0., 0., 1.);
          }
          vAo = ao/27.0;
          vSkyLight = skyLight/8.0;
          vTorchLight = torchLight/8.0;

          vSelectColor = vec3(0.);
          if (
            position.x >= uSelectRange.x &&
            position.z >= uSelectRange.y &&
            position.x < uSelectRange.z &&
            position.z < uSelectRange.w
          ) {
            vSelectColor = vec3(${new THREE.Color(0x4fc3f7).toArray().join(', ')});
          }

          vec3 vert_tang;
          vec3 vert_bitang;
          if (abs(normal.y) < 0.05) {
            if (abs(normal.x) > 0.95) {
              vert_bitang = vec3(0., 1., 0.);
              vert_tang = normalize(cross(vert_bitang, normal));
              vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
            } else {
              vert_bitang = vec3(0., 1., 0.);
              vert_tang = normalize(cross(vert_bitang, normal));
              vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
            }
          } else {
            vert_tang = vec3(1., 0., 0.);
            vert_bitang = normalize(cross(vert_tang, normal));
            vWorldUv = vec2(dot(position, vert_tang), dot(position, vert_bitang));
          }
          vWorldUv /= 4.0;
          vec3 vert_norm = normal;

          vec3 t = normalize(normalMatrix * vert_tang);
          vec3 b = normalize(normalMatrix * vert_bitang);
          vec3 n = normalize(normalMatrix * vert_norm);
          mat3 tbn = transpose(mat3(t, b, n));

          vPos = position;
          vNormal = normal;
        }
      `,
      fragmentShader: `\
        precision highp float;
        precision highp int;

        #define PI 3.1415926535897932384626433832795

        uniform float sunIntensity;
        uniform sampler2D tex;
        // uniform float uTime;
        uniform vec3 sunDirection;
        float parallaxScale = 0.3;
        float parallaxMinLayers = 50.;
        float parallaxMaxLayers = 50.;

        varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vBarycentric;
        varying float vAo;
        varying float vSkyLight;
        varying float vTorchLight;
        varying vec3 vSelectColor;
        varying vec2 vWorldUv;
        varying vec3 vPos;
        varying vec3 vNormal;

        float edgeFactor(vec2 uv) {
          float divisor = 0.5;
          float power = 0.5;
          return min(
            pow(abs(uv.x - round(uv.x/divisor)*divisor), power),
            pow(abs(uv.y - round(uv.y/divisor)*divisor), power)
          ) > 0.1 ? 0.0 : 1.0;
        }

        vec3 getTriPlanarBlend(vec3 _wNorm){
          // in wNorm is the world-space normal of the fragment
          vec3 blending = abs( _wNorm );
          // blending = normalize(max(blending, 0.00001)); // Force weights to sum to 1.0
          // float b = (blending.x + blending.y + blending.z);
          // blending /= vec3(b, b, b);
          // return min(min(blending.x, blending.y), blending.z);
          blending = normalize(blending);
          return blending;
        }

        void main() {
          // vec3 diffuseColor1 = vec3(${new THREE.Color(0x1976d2).toArray().join(', ')});
          vec3 diffuseColor2 = vec3(${new THREE.Color(0x64b5f6).toArray().join(', ')});
          float normalRepeat = 1.0;

          vec3 blending = getTriPlanarBlend(vNormal);
          float xaxis = edgeFactor(vPos.yz * normalRepeat);
          float yaxis = edgeFactor(vPos.xz * normalRepeat);
          float zaxis = edgeFactor(vPos.xy * normalRepeat);
          float f = xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;

          // vec2 worldUv = vWorldUv;
          // worldUv = mod(worldUv, 1.0);
          // float f = edgeFactor();
          // float f = max(normalTex.x, normalTex.y, normalTex.z);

          float d = gl_FragCoord.z/gl_FragCoord.w;
          vec3 c = diffuseColor2; // mix(diffuseColor1, diffuseColor2, abs(vPos.y/10.));
          // float f2 = 1. + d/10.0;
          gl_FragColor = vec4(c, 0.5 + max(f, 0.3));
        }
      `,
      transparent: true,
      // polygonOffset: true,
      // polygonOffsetFactor: -1,
      // polygonOffsetUnits: 1,
    }); */
    
    const material = floorMesh.material;
    const roadMesh = new THREE.Mesh(geometry, material);
    roadMesh.frustumCulled = false;
    object.add(roadMesh);
    // const roadPhysicsId = physics.addGeometry(roadMesh);
  })();

  /* (async () => {
    const signsMesh = await new Promise((accept, reject) => {
      gltfLoader.load(`https://webaverse.github.io/street-assets/sign.glb`, function(object) {
        object = object.scene;

        accept(object);
      }, function progress() {}, reject);
    });

    const signMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(12, 3), new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }));
    signMesh.position.set(10/2, 2, 10);
    signMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2);

    const japanese = signsMesh.getObjectByName('Japanese');
    
    japanese.position.set(-4, 0, 0.05);
    japanese.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2));
    japanese.material = new THREE.MeshBasicMaterial({
      color: 0x26c6da,
      side: THREE.DoubleSide,
    });
    signMesh.add(japanese);

    const english = signsMesh.getObjectByName('English');
    english.position.set(2, -0.5, 0.01);
    english.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2));
    english.material = new THREE.MeshBasicMaterial({
      color: 0xec407a,
      side: THREE.DoubleSide,
    });
    signMesh.add(english);

    object.add(signMesh);
  })(); */

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
        /* const dynamicPositionYs = new Float32Array(geometry.attributes.position.array.length/3);
        for (let i = 0; i < dynamicPositionYs.length; i += 3) {
          const x = geometry.attributes.position.array[i*3];
          const z = geometry.attributes.position.array[i*3+2];

          // const d = Math.abs(x); 
          // const f = Math.min(Math.max((d - 5) / 30, 0), 1)**2;

          const y = simplex3.noise2D(x/500, z/500) * 3;
          dynamicPositionYs[i] = y;
          dynamicPositionYs[i+1] = y;
          dynamicPositionYs[i+2] = y;
        }
        geometry.setAttribute('dynamicPositionY', new THREE.BufferAttribute(dynamicPositionYs, 1)); */
        
        geometry.computeVertexNormals();

        geometry = geometry.toNonIndexed();
        /* const barycentrics = new Float32Array(geometry.attributes.position.array.length);
        let barycentricIndex = 0;
        for (let i = 0; i < geometry.attributes.position.array.length; i += 9) {
          barycentrics[barycentricIndex++] = 1;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 1;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 0;
          barycentrics[barycentricIndex++] = 1;
        }
        geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3)); */

        return geometry;
      })();

      const prefix = 'Vol_21_4';

      const diffuse1 = textureLoader.load(`https://webaverse.github.io/street-assets/textures/${prefix}_Base_Color.jpg`);
      diffuse1.wrapS = THREE.RepeatWrapping;
      diffuse1.wrapT = THREE.RepeatWrapping;
      diffuse1.anisotropy = 16;
      const normal1 = textureLoader.load(`https://webaverse.github.io/street-assets/textures/${prefix}_Normal.jpg`);
      normal1.wrapS = THREE.RepeatWrapping;
      normal1.wrapT = THREE.RepeatWrapping;
      normal1.anisotropy = 16;

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
          #define PI 3.1415926535897932384626433832795

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
    const terrainPhysicsId = physics.addGeometry(terrainMesh);
  }

  (async () => {
    const rng = alea('lol');
    
    const modularMesh = await new Promise((accept, reject) => {
      gltfLoader.load(`https://webaverse.github.io/street-assets/stacks.glb`, function(object) {
        object = object.scene;

        accept(object);
      }, function progress() {}, reject);
    });
    const floorMap = {
      [JSON.stringify([
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ])]: {
        name: 'Floor',
        quaternion: new THREE.Quaternion(),
      },
      [JSON.stringify([
        [0, 1, 0],
        [0, 1, 0],
        [0, 0, 0],
      ])]: {
        name: 'I',
        quaternion: new THREE.Quaternion(),
      },
      [JSON.stringify([
        [0, 0, 0],
        [1, 1, 0],
        [0, 0, 0],
      ])]: {
        name: 'I',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2),
      },
      [JSON.stringify([
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 0],
      ])]: {
        name: 'I',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      },
      [JSON.stringify([
        [0, 0, 0],
        [0, 1, 1],
        [0, 0, 0],
      ])]: {
        name: 'I',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI*3/2),
      },
      [JSON.stringify([
        [0, 1, 0],
        [1, 1, 0],
        [0, 0, 0],
      ])]: {
        name: 'R',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      },
      [JSON.stringify([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ])]: {
        name: 'R',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI*3/2),
      },
      [JSON.stringify([
        [0, 0, 0],
        [0, 1, 1],
        [0, 1, 0],
      ])]: {
        name: 'R',
        quaternion: new THREE.Quaternion(),
      },
      [JSON.stringify([
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ])]: {
        name: 'R',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2),
      },
      [JSON.stringify([
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ])]: {
        name: '-',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2),
      },
      [JSON.stringify([
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ])]: {
        name: '-',
        quaternion: new THREE.Quaternion(),
      },
      [JSON.stringify([
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ])]: {
        name: 'T',
        quaternion: new THREE.Quaternion(),
      },
      [JSON.stringify([
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ])]: {
        name: 'T',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2),
      },
      [JSON.stringify([
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ])]: {
        name: 'T',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      },
      [JSON.stringify([
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ])]: {
        name: 'T',
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI*3/2),
      },
      [JSON.stringify([
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0],
      ])]: {
        name: 'O',
        quaternion: new THREE.Quaternion(),
      },
    };

    const geometries = [];
    const _mergeMesh = (m, p, q) => {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().compose(
        p.clone()
          .add(new THREE.Vector3(0, (((p.x + p.z) / w) % 2) === 0 ? 0.001 : 0, 0)), // slight offset to remove y glitching
        q,
        localVector.set(1, 1, 1)
      ));
      geometries.push(g);
    };

    for (let dy = 0; dy < 10; dy++) {
      const width = 2 + Math.floor(rng() * 10);
      const height = 2 + Math.floor(rng() * 10);
      const testMap = Array(height);
      for (let i = 0; i < height; i++) {
        testMap[i] = Array(width).fill(0);
      }
      const [
        startPoint,
        startPoint2,
      ] = (() => {
        const r = rng();
        if (r < 0.25) { // left
          const v = new THREE.Vector2(-1, Math.floor(rng() * height));
          return [
            v,
            v.clone().add(new THREE.Vector2(1, 0)),
          ];
        } else if (r < 0.5) { // right
          const v = new THREE.Vector2(width, Math.floor(rng() * height));
          return [
            v,
            v.clone().add(new THREE.Vector2(-1, 0)),
          ];
        } else if (r < 0.75) { // up
          const v = new THREE.Vector2(Math.floor(rng() * width), -1);
          return [
            v,
            v.clone().add(new THREE.Vector2(0, 1)),
          ];
        } else { // down
          const v = new THREE.Vector2(Math.floor(rng() * width), height);
          return [
            v,
            v.clone().add(new THREE.Vector2(0, -1)),
          ];
        }
      })();
      const _walkTestMap = () => {
        const walkLength = Math.floor(1 + rng() * width * height);
        const position = startPoint2.clone();
        for (let i = 0; i < walkLength; i++) {
          if (position.x >= testMap[position.y].length) {
            debugger;
          }
          testMap[position.y][position.x] = 1;
          const r = rng();
          if (r < 0.25) { // left
            position.x = Math.max(position.x - 1, 0);
          } else if (r < 0.5) { // right
            position.x = Math.min(position.x + 1, width - 1);
          } else if (r < 0.75) { // up
            position.y = Math.max(position.y - 1, 0);
          } else { // down
            position.y = Math.min(position.y + 1, height - 1);
          }
        }
      };
      _walkTestMap();

      /* if (dy !== 4) {
        continue;
      } */

      const _printTestMap = testMap => {
        console.log(testMap.map(l => l.join(',')).join('\n'));
      };
      // _printTestMap(testMap);

      const _getTestMap = (x, z) => {
        if (x === startPoint.x && z === startPoint.y) {
          return 1;
        } else {
          return (testMap[z] || [])[x] || 0;
        }
      };
      for (let dx = 0; dx < width; dx++) {
        for (let dz = 0; dz < height; dz++) {
          if (_getTestMap(dx, dz)) {
            const up = _getTestMap(dx, dz - 1);
            const left = _getTestMap(dx - 1, dz);
            const right = _getTestMap(dx + 1, dz);
            const down = _getTestMap(dx, dz + 1);
            
            const j = [
              [0, up, 0],
              [left, 1, right],
              [0, down, 0],
            ];
            const s = JSON.stringify(j);
            const entry = floorMap[s];
            
            if (entry) {
              const o = modularMesh.getObjectByName(entry.name);
              if (o) {
                _mergeMesh(o, new THREE.Vector3(dx*w + w*3, dy*w, dz*w), entry.quaternion);
              } else {
                debugger;
              }
            } else {
              debugger;
            }
          }
        }
      }
    }

    const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
    const material = modularMesh.getObjectByName('O').material;
    const modularMeshSingle = new THREE.Mesh(geometry, material);
    modularMeshSingle.frustumCulled = false;
    object.add(modularMeshSingle);
    const modularPhysicsId = physics.addGeometry(modularMeshSingle);
  })();

  return object;
})();
app.object.add(stacksMesh);

(async () => {
  const sakuraMesh = await new Promise((accept, reject) => {
    gltfLoader.load(`https://webaverse.github.io/street-assets/sakura.glb`, function(object) {
      // console.log('loaded', object);
      object = object.scene;
      object.scale.multiplyScalar(3);
      // object.position.y = 2;
      // window.object = object;
      // scene.add( object );
      // app.object.add(object);
      accept(object);
      // render();
    }, function progress() {}, reject);
  });
  for (const parcelSpec of parcelSpecs) {
    const m = sakuraMesh.clone();
    m.position.copy(parcelSpec.position)
      .add(parcelSpec.size.clone().multiplyScalar(0.5));
    app.object.add(m);
  }
})();

/* let beat = false;
let beatReady = false;
const listener = new THREE.AudioListener();
rootScene.add(listener);
const sound = new THREE.Audio(listener);
new THREE.AudioLoader().load(`https://avaer.github.io/assets-private/mnleo.mp3`, function( buffer ) {
  sound.setBuffer(buffer);
  sound.setLoop(true);
  // sound.setVolume(0.5);
  // sound.play();
  beatReady = true;
});
const analyser = new THREE.AudioAnalyser(sound, 32);
const _keydown = e => {
  switch (e.which) {
    case 77: { // M
      if (beatReady) {
        beat = !beat;
        if (beat) {
          sound.play();
        } else {
          sound.pause();
        }
      }
      break;
    }
  }
};
window.addEventListener('keydown', _keydown);
app.addEventListener('unload', () => {
  window.removeEventListener('keydown', _keydown);
}); */

/* appManager.addEventListener('use', () => {
  universe.enterWorld({
    objects: [
      {
        position: [-3, 0, -10],
        contentId: 'https://avaer.github.io/shield/index.js',
      },
    ],
    extents: [
      portalMesh.boundingBox.min.toArray(),
      portalMesh.boundingBox.max.toArray(),
    ],
  });
  // rootScene.visible = !rootScene.visible;
}); */

let lastUpdateTime = Date.now();
renderer.setAnimationLoop(() => {
  const now = Date.now();

  const transforms = rig.getRigTransforms();
  const {position} = transforms[0];
  const f = 1 - Math.min(Math.max(-position.z / 30, -0.3), 0.3) / 0.3;

  streetMesh.material.uniforms.uTime.value = (now%10000)/20;
  // floorMesh.material.uniforms.uAnimation.value = (now%2000)/2000;
  particlesMesh.material.uniforms.uColor.value = f;
  particlesMesh.material.uniforms.uTime.value = (now%10000)/10000;

  /* if (beat) {
    const fd = analyser.getFrequencyData();
    const v = fd[4];
    const beatValue = Math.min(v/255, 1);
    const beatValue2 = Math.min(v/255, 1);
    streetMesh.material.uniforms.uBeat.value = beatValue;
    gridMesh.material.uniforms.uBeat.value = beatValue;
    gridMesh.material.uniforms.uBeat2.value = beatValue2;
    particlesMesh.material.uniforms.uBeat.value = beatValue;
    particlesMesh.material.uniforms.uBeat2.value = beatValue2;
  } else {
    streetMesh.material.uniforms.uBeat.value = 1;
    gridMesh.material.uniforms.uBeat.value = 1;
    gridMesh.material.uniforms.uBeat2.value = 0;
    particlesMesh.material.uniforms.uBeat.value = 1;
    particlesMesh.material.uniforms.uBeat2.value = 0;
  } */
  
  lastUpdateTime = now;
});