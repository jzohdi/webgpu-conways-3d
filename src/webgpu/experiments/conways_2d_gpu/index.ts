import { MainFunction } from "..";

export const main: MainFunction = async (
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) => {
  // const {CELL_SIZE, GRID_COLS, GRID_ROWS, gridState } = generateSquaresBuffer(context);
  const CELL_SIZE = 20;
  const GRID_COLS = 100;
  const GRID_ROWS = 60;
  const gridState = new Array(GRID_ROWS).map(_ => new Array(GRID_COLS).fill(0));
  // console.log({CELL_SIZE, GRID_COLS, GRID_ROWS, gridState })
  const totalSquares = GRID_COLS * GRID_ROWS;
  const numWorkGroups = Math.ceil((totalSquares)/64);
  // const numWorkGroups = 1;
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
  const squareSize = CELL_SIZE; // Size of the square in pixels
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
    size: Uint32Array.BYTES_PER_ELEMENT * totalSquares, // 1 value: 0 or 1
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(stateBuffer.getMappedRange()).set(gridState.flatMap(i => i)); // Start as white
  stateBuffer.unmap();

  const arrayLengthBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT, // 1 u32 value
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  
  // Write the array length into the buffer
  new Uint32Array(arrayLengthBuffer.getMappedRange()).set([totalSquares]);
  arrayLengthBuffer.unmap();

  // Compute shader to toggle the state
  const computeShaderModule = device.createShaderModule({
    code: `
      @group(0) @binding(0) var<storage, read_write> state: array<atomic<u32>>;
      
      @compute @workgroup_size(${numWorkGroups})
      fn main() {
        for (var i = 0u; i < ${totalSquares}u; i++) {
          let current = atomicLoad(&state[i]);
          atomicStore(&state[i], 1u - current);
        }
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
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) @interpolate(flat) instanceIndex: u32,
    };
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read_write> state: array<atomic<u32>>;

    @vertex
    fn main_vertex(
        @location(0) position: vec2<f32>,
        @builtin(instance_index) instanceIndex: u32
    ) -> VertexOutput {
        let gridWidth = ${GRID_COLS}u; // Number of squares per row
        let xIndex = instanceIndex % gridWidth; // Column index
        let yIndex = instanceIndex / gridWidth; // Row index

        // Calculate offsets for each square
        let offset = vec2<f32>(
          -1.0 + f32(xIndex) * uniforms.size.x + ${CELL_SIZE/1000},
          1.0 - f32(yIndex) * uniforms.size.y - ${CELL_SIZE/1000}
        );

        let pos = position * uniforms.size + offset;

        return VertexOutput(
            vec4<f32>(pos, 0.0, 1.0),
            instanceIndex
        );
    }


    @fragment
    fn main_fragment(
        @location(0) @interpolate(flat) instanceIndex: u32
    ) -> @location(0) vec4<f32> {
        // Use the state corresponding to the current instance index
        let currentState = atomicLoad(&state[instanceIndex]);
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
          arrayStride: 2 * 4, // Two floats for position (x, y)
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
  const render = async () => {
    // Compute pass to toggle the state
    const computeEncoder = device.createCommandEncoder();
    const computePass = computeEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    const numWorkGroups = Math.ceil((totalSquares)/64);
    computePass.dispatchWorkgroups(numWorkGroups); // Single workgroup to update state
    computePass.end();
    device.queue.submit([computeEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();
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
    passEncoder.draw(6, totalSquares, 0, 0);
    // passEncoder.draw(6, 2, 0, 0); // Draw 2 triangles (6 vertices)
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    // const debugState = new Uint32Array(totalSquares);
    // Example usage
    // debugBufferCopy(device, stateBuffer, totalSquares);
    // console.log('State buffer contents:', debugState);
    // Request the next frame
    animationFrameId = requestAnimationFrame(render);
  };

  // Start rendering
  render();

  // Return a cancel function to stop rendering
  return () => cancelAnimationFrame(animationFrameId);
};


function generateSquaresBuffer(context: GPUCanvasContext) {
  const SCALE_DOWN_FACTOR = 1;
  const SQUARE_SIZE_PIXELS = 20; // Each square is 20x20 pixels
  const CELL_SIZE = SQUARE_SIZE_PIXELS / SCALE_DOWN_FACTOR;
  let GRID_ROWS: number;
  let GRID_COLS: number;

  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;
  
  // Calculate the number of squares that fit horizontally and vertically
  const squaresAcrossWidth = Math.ceil(canvasWidth / CELL_SIZE); 
  const squaresAcrossHeight = Math.ceil(canvasHeight / CELL_SIZE);
  
  // Set the grid dimensions based on the smaller dimension
  GRID_COLS = squaresAcrossWidth;
  GRID_ROWS = squaresAcrossHeight;

  // Calculate CELL_SIZE based on the smaller dimension in normalized device coordinates
  // const canvasAspectRatio = canvasWidth / canvasHeight;

  const gridState = new Array(GRID_ROWS)
  for (let i = 0; i < GRID_ROWS; i++) {
    const innerState = [];
    for (let j=0; j < GRID_COLS;j++ ) {
      innerState.push((Math.random() < 0.35 ? 1 : 0))
    }
    gridState.push(innerState)
  }
  // Initialize the grid state (random black/white squares)
  // const gridState = new Array(GRID_ROWS).map(_ => new Array(GRID_COLS).map(_ => (Math.random() < 0.35 ? 1 : 0))
  // );
  return { GRID_ROWS, GRID_COLS, gridState, CELL_SIZE}
}

async function debugBufferCopy(device: GPUDevice, sourceBuffer: GPUBuffer, totalSquares: number) {
  const stagingBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT * totalSquares,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Create a command encoder to copy the data
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(sourceBuffer, 0, stagingBuffer, 0, stagingBuffer.size);
  device.queue.submit([commandEncoder.finish()]);

  // Read the staging buffer
  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const mappedRange = stagingBuffer.getMappedRange();
  const data = new Uint32Array(mappedRange);
  console.log('Copied buffer contents:', data);
  stagingBuffer.unmap();
}