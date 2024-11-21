export async function main(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
): Promise<() => void> {
  const GRID_SIZE = 32; // Grid dimensions (32 x 32 = 1024 squares)
  const CELL_SIZE = 1 / 32; // Size of each cell in normalized device coordinates
  const instanceCount = GRID_SIZE * GRID_SIZE;

  // Create a unit square vertex buffer
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

  const vertexBuffer = device.createBuffer({
    size: unitSquareVertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(unitSquareVertices);
  vertexBuffer.unmap();

  // Create instance buffers: position + scale (16 bytes) and color (12 bytes)
  const positionScaleData = new Float32Array(instanceCount * 4); // [x, y, scaleX, scaleY]
  const colorData = new Float32Array(instanceCount * 3); // [r, g, b]

  let index = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Calculate position of each square
      const x = (col - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
      const y = (row - GRID_SIZE / 2 + 0.5) * CELL_SIZE;

      // Set position and scale
      positionScaleData[index * 4 + 0] = x; // x position
      positionScaleData[index * 4 + 1] = y; // y position
      positionScaleData[index * 4 + 2] = CELL_SIZE; // scaleX
      positionScaleData[index * 4 + 3] = CELL_SIZE; // scaleY

      // Randomize color (35% black, 65% white)
      const isBlack = Math.random() < 0.35;
      colorData[index * 3 + 0] = isBlack ? 0.0 : 1.0; // r
      colorData[index * 3 + 1] = isBlack ? 0.0 : 1.0; // g
      colorData[index * 3 + 2] = isBlack ? 0.0 : 1.0; // b

      index++;
    }
  }

  const positionScaleBuffer = device.createBuffer({
    size: positionScaleData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(positionScaleBuffer.getMappedRange()).set(positionScaleData);
  positionScaleBuffer.unmap();

  const colorBuffer = device.createBuffer({
    size: colorData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(colorBuffer.getMappedRange()).set(colorData);
  colorBuffer.unmap();

  // Create shader modules
  const shaderModule = device.createShaderModule({
    code: `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(2) color: vec3<f32>,
      };

      @vertex
      fn main_vertex(
        @location(0) position: vec2<f32>,
        @location(1) instancePosScale: vec4<f32>,
        @location(2) instanceColor: vec3<f32>
      ) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4<f32>(position * instancePosScale.zw + instancePosScale.xy, 0.0, 1.0);
        output.color = instanceColor;
        return output;
      }

      @fragment
      fn main_fragment(
        @location(2) color: vec3<f32>
      ) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0);
      }
    `,
  });

  // Create render pipeline
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "main_vertex",
      buffers: [
        {
          arrayStride: 2 * 4, // Two floats (x, y) per vertex
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 4 * 4, // Four floats (x, y, scaleX, scaleY) per instance
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x4" }, // Position and scale
          ],
        },
        {
          arrayStride: 3 * 4, // Three floats (r, g, b) per instance
          stepMode: "instance",
          attributes: [
            { shaderLocation: 2, offset: 0, format: "float32x3" }, // Color
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "main_fragment",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  // Render loop
  let animationFrameId: number;
  function render() {
    const commandEncoder = device.createCommandEncoder();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 }, // Light gray background
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setVertexBuffer(1, positionScaleBuffer); // Position and scale
    passEncoder.setVertexBuffer(2, colorBuffer); // Colors
    passEncoder.draw(6, instanceCount, 0, 0); // 6 vertices per square, instanceCount instances
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    // animationFrameId = requestAnimationFrame(render);
  }
  render();

  return () => cancelAnimationFrame(animationFrameId);
}
