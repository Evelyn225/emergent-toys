lowerWorks();
serviceTunnel();
drawMap();
scene.updateMatrixWorld(true);
// Render the static architecture in four batches. Keep the original floor
// meshes and their world matrices for precise raycasting after batching.
function batchArchitecture() {
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  for (const mat of [concrete,steel,pale,lit,rock]) {
    const objects = scene.children.filter(obj => obj.isMesh && obj.material === mat && !obj.userData.dynamic);
    let vertexCount = 0, indexCount = 0;
    for (const obj of objects) {
      vertexCount += obj.geometry.attributes.position.count;
      indexCount += obj.geometry.index ? obj.geometry.index.count : obj.geometry.attributes.position.count;
    }
    const positions = new Float32Array(vertexCount*3), normals = new Float32Array(vertexCount*3), tiles = new Float32Array(vertexCount*3);
    const indices = new Uint32Array(indexCount);
    let vertexOffset = 0, indexOffset = 0;
    for (const obj of objects) {
      const geom = obj.geometry, pos = geom.attributes.position, norm = geom.attributes.normal, tile = geom.attributes.tile;
      if (tile) tiles.set(tile.array,vertexOffset*3);
      normalMatrix.getNormalMatrix(obj.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos,i).applyMatrix4(obj.matrixWorld).toArray(positions,(vertexOffset+i)*3);
        normal.fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize().toArray(normals,(vertexOffset+i)*3);
      }
      const count = geom.index ? geom.index.count : pos.count;
      for (let i = 0; i < count; i++) indices[indexOffset+i] = vertexOffset+(geom.index ? geom.index.getX(i) : i);
      vertexOffset += pos.count; indexOffset += count;
      scene.remove(obj);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.setAttribute('tile',new THREE.BufferAttribute(tiles,3));
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    mesh(geometry,mat);
  }
}
batchArchitecture();
