export function getUnitSquareVertices(device: GPUDevice): GPUBuffer {
  const unitSquareVertices = new Float32Array([
    // Triangle 1
    -0.5,
    0.5, // Top-left
    0.5,
    0.5, // Top-right
    -0.5,
    -0.5, // Bottom-left
    // Triangle 2
    -0.5,
    -0.5, // Bottom-left
    0.5,
    0.5, // Top-right
    0.5,
    -0.5, // Bottom-right
  ]);

  const unitSquareVertexBuffer = device.createBuffer({
    size: unitSquareVertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(unitSquareVertexBuffer.getMappedRange()).set(
    unitSquareVertices
  );
  unitSquareVertexBuffer.unmap();
  return unitSquareVertexBuffer;
}

export function getInstaneBuffer(instanceCount: number, device: GPUDevice) {
  const instanceData = new Float32Array(instanceCount * 4); // Each instance: [x, y, width, height]

  // Populate instance data
  for (let i = 0; i < instanceCount; i++) {
    const x = Math.random() * 2 - 1; // Random X position in [-1, 1]
    const y = Math.random() * 2 - 1; // Random Y position in [-1, 1]
    const size = Math.random() * 0.05 + 0.02; // Random size in [0.02, 0.07]

    instanceData[i * 4 + 0] = x; // Position X
    instanceData[i * 4 + 1] = y; // Position Y
    instanceData[i * 4 + 2] = size; // Width
    instanceData[i * 4 + 3] = size; // Height
  }

  // Create GPU buffer for instance data
  const instanceBuffer = device.createBuffer({
    size: instanceData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(instanceBuffer.getMappedRange()).set(instanceData);
  instanceBuffer.unmap();
  return instanceBuffer;
}
