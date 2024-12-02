import { MainFunction } from "..";

export const main: MainFunction = async (
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) => {
  // Create a square vertex buffer for a 1x1 unit square centered at (0, 0)
  const squareVertices = new Float32Array([
    // Triangle 1
    -0.5,  0.5, // Top-left
     0.5,  0.5, // Top-right
    -0.5, -0.5, // Bottom-left
    // Triangle 2
    -0.5, -0.5, // Bottom-left
     0.5,  0.5, // Top-right
     0.5, -0.5, // Bottom-right
  ]);

  const vertexBuffer = device.createBuffer({
    size: squareVertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(squareVertices);
  vertexBuffer.unmap();

  // Create a uniform buffer for the square size and position
  const squareSize = 20; // Size of the square in pixels
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;

  const uniformData = new Float32Array([
    0, 0, // Center of the canvas in normalized coordinates
    squareSize / canvasWidth * 2, // Width in normalized coordinates
    squareSize / canvasHeight * 2, // Height in normalized coordinates
  ]);

  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  new Float32Array(uniformBuffer.getMappedRange()).set(uniformData);
  uniformBuffer.unmap();

  // Create a buffer to store the state of the square (0 = white, 1 = black)
  const stateBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT * 2, // 1 value: 0 or 1
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(stateBuffer.getMappedRange()).set([0, 1]); // Start as white
  stateBuffer.unmap();

  // Compute shader to toggle the state
  const computeShaderModule = device.createShaderModule({
    code: `
      @group(0) @binding(0) var<storage, read_write> state: array<atomic<u32>, 2>;

      @compute @workgroup_size(1)
      fn main() {
        // Toggle between 0 and 1
        let current = atomicLoad(&state[0]);
        atomicStore(&state[0], 1u - current);
      }
    `,
  });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: computeShaderModule,
      entryPoint: 'main',
    },
  });
  
  
  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
    ],
  });

  // Render shader
  const shaderModule = device.createShaderModule({
    code: `
      struct Uniforms {
        center: vec2<f32>,
        size: vec2<f32>,
      };

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read_write> state: array<atomic<u32>, 2>;

      @vertex
      fn main_vertex(
        @location(0) position: vec2<f32>
      ) -> @builtin(position) vec4<f32> {
        let pos = position * uniforms.size + uniforms.center;
        return vec4<f32>(pos, 0.0, 1.0);
      }

      @fragment
      fn main_fragment() -> @location(0) vec4<f32> {
        let currentState = atomicLoad(&state[0]);
        if (currentState == 1u) {
          return vec4<f32>(0.0, 0.0, 0.0, 1.0); // Black color
        } else {
          return vec4<f32>(1.0, 1.0, 1.0, 1.0); // White color
        }
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'main_vertex',
      buffers: [
        {
          arrayStride: 2 * 4, // Two floats (x, y)
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'main_fragment',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: stateBuffer } },
    ],
  });

  // Animation loop
  let animationFrameId: number;
  const render = () => {
    // Compute pass to toggle the state
    const computeEncoder = device.createCommandEncoder();
    const computePass = computeEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(1); // Single workgroup to update state
    computePass.end();
    device.queue.submit([computeEncoder.finish()]);

    // Render pass
    const commandEncoder = device.createCommandEncoder();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 }, // Light gray background
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.draw(6, 1, 0, 0); // Draw 2 triangles (6 vertices)
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    // Request the next frame
    animationFrameId = requestAnimationFrame(render);
  };

  // Start rendering
  render();

  // Return a cancel function to stop rendering
  return () => cancelAnimationFrame(animationFrameId);
};
