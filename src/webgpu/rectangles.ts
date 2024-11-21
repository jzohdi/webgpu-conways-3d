function createRectangleVertices(
  x: number,
  y: number,
  width: number,
  height: number
): Float32Array {
  const x1 = x;
  const y1 = y;
  const x2 = x + width;
  const y2 = y + height;

  // Rectangle defined as two triangles
  return new Float32Array([
    // Triangle 1
    x1,
    y1, // Top-left
    x2,
    y1, // Top-right
    x1,
    y2, // Bottom-left

    // Triangle 2
    x1,
    y2, // Bottom-left
    x2,
    y1, // Top-right
    x2,
    y2, // Bottom-right
  ]);
}

function createRectangleBatch(
  rectangles: Array<{ x: number; y: number; width: number; height: number }>
): Float32Array {
  const vertexData: Float32Array[] = rectangles.map(({ x, y, width, height }) =>
    createRectangleVertices(x, y, width, height)
  );

  // Determine total size
  const totalSize = vertexData.reduce((sum, arr) => sum + arr.length, 0);

  // Allocate a single Float32Array to hold all data
  const mergedData = new Float32Array(totalSize);

  // Copy each Float32Array into the merged array
  let offset = 0;
  for (const arr of vertexData) {
    mergedData.set(arr, offset);
    offset += arr.length;
  }

  return mergedData;
}

class RectangleRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;

  constructor(device: GPUDevice, pipeline: GPURenderPipeline) {
    this.device = device;
    this.pipeline = pipeline;
  }

  createRectangleBatch(
    rectangles: Array<{ x: number; y: number; width: number; height: number }>
  ) {
    const vertexData = createRectangleBatch(rectangles);
    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();
    return vertexBuffer;
  }

  draw(
    passEncoder: GPURenderPassEncoder,
    vertexBuffer: GPUBuffer,
    rectangleCount: number
  ) {
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.draw(6 * rectangleCount, 1, 0, 0);
  }
}
