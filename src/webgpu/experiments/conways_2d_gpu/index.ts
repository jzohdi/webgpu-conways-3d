import { MainFunction } from "..";

export const main: MainFunction = async (
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) => {
  const SQUARE_SIZE_PIXELS = 20; // Each square is 20x20 pixels
  const {CELL_SIZE, GRID_COLS, GRID_ROWS, gridState } = generateSquaresBuffer(context, SQUARE_SIZE_PIXELS);
  // const CELL_SIZE = 20;
  // const GRID_COLS = 70;
  // const GRID_ROWS = 70;
  // const gridState = new Array(GRID_ROWS).map(_ => new Array(GRID_COLS).fill(1));
  // console.log({CELL_SIZE, GRID_COLS, GRID_ROWS, gridState })
  const totalSquares = GRID_COLS * GRID_ROWS;
  // Create initial grid state buffer
  const gridStateBuffer = device.createBuffer({
    size: GRID_COLS * GRID_ROWS * 4, // 4 bytes per cell (32-bit uint)
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX, 
    mappedAtCreation: true
  });

  // Convert gridState to Uint32Array
  // const gridStateArray = new Uint32Array(GRID_COLS * GRID_ROWS);
  // for (let row = 0; row < GRID_ROWS; row++) {
  //   for (let col = 0; col < GRID_COLS; col++) {
  //     gridStateArray[row * GRID_COLS + col] = Math.random() > .30 ? 0: 1;
  //   }
  // }
  const gridStateArray = new Uint32Array(gridState.flatMap(c => c))
  // Copy data to buffer
  new Uint32Array(gridStateBuffer.getMappedRange()).set(gridStateArray);
  gridStateBuffer.unmap();

  const gridStateBufferSize = GRID_COLS * GRID_ROWS * 4;
  
  // Create a buffer for the next state
  const nextGridStateBuffer = device.createBuffer({
    size: GRID_COLS * GRID_ROWS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
    mappedAtCreation: true
  });

   // Also unmap nextGridStateBuffer
   new Uint32Array(nextGridStateBuffer.getMappedRange()).set(new Uint32Array(GRID_COLS * GRID_ROWS));
   nextGridStateBuffer.unmap();

  // Create a staging buffer for reading back state
  // const stagingBuffer = device.createBuffer({
  //   size: gridStateBufferSize,
  //   usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  // });

  // Compute Shader Module
  const computeShaderModule = device.createShaderModule({
    code: /* wgsl */`
      struct Grid {
        data: array<u32>
      }

      @group(0) @binding(0) var<storage, read> inputGrid: Grid;
      @group(0) @binding(1) var<storage, read_write> outputGrid: Grid;

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let grid_x = global_id.x;
        let grid_y = global_id.y;
        
        // Ensure we're within grid bounds
        if (grid_x >= ${GRID_COLS}u || grid_y >= ${GRID_ROWS}u) {
          return;
        }
        let index = grid_y * ${GRID_COLS}u + grid_x;
        
        var num_living_neighbors: u32 = 0;
        
        for (var dx: i32 = -1; dx < 1; dx = dx + 1) {
          for (var dy: i32 = -1; dy < 1; dy = dy + 1) {
            if (dx == 0 && dy == 0) {
              continue;
            }
            let neigh_x = i32(grid_x) + dx;
            let neigh_y = i32(grid_y) + dy;

            if (neigh_x >= 0 && neigh_y >= 0 &&
                neigh_x < i32(${GRID_COLS}) && neigh_y < i32(${GRID_ROWS})) {

              let neighbor_index = u32(neigh_y) * ${GRID_COLS}u + u32(neigh_x);
              let current_neighbor_state = inputGrid.data[neighbor_index];
              if (current_neighbor_state > 0u) {
                num_living_neighbors += 1u;
              }
            }
          }
        }

        let current_state = inputGrid.data[index];
        // outputGrid.data[index] = current_state;
        if (current_state == 1u) {
          if (num_living_neighbors == 2u || num_living_neighbors == 3u) {
            outputGrid.data[index] = 1;
          } else {
            outputGrid.data[index] = 0;
          }
        } else {
          if (num_living_neighbors == 3) {
            outputGrid.data[index] = 1u;
          } else {
            outputGrid.data[index] = 0u;
          }
        }
        // if (current_state == 1u) {
        //   if (num_living_neighbors < 2u) {
        //     outputGrid.data[index] = 0;
        //   }else if (num_living_neighbors > 3u) {
        //     outputGrid.data[index] = 0;
        //   } else {
        //     outputGrid.data[index] = 1u;
        //   }
        // } else {
        //   if (num_living_neighbors == 3) {
        //     outputGrid.data[index] = 1;
        //   } else {
        //     outputGrid.data[index] = 0;
        //   }
        // }
        // outputGrid.data[index] = 1u;
        // Simple state flip logic
        // outputGrid.data[index] = 1u - inputGrid.data[index];
      }
    `
  });

  // Compute Pipeline
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: computeShaderModule,
      entryPoint: 'main'
    }
  });

  // Bind Group for Compute
  let computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: gridStateBuffer } },
      { binding: 1, resource: { buffer: nextGridStateBuffer } }
    ]
  });

  // Vertex Shader Module
  const vertexShaderModule = device.createShaderModule({
    code: `
      struct VertexInput {
        @location(0) pos: vec2f,
        @location(1) color: vec4f
      }

      struct VertexOutput {
        @builtin(position) clip_position: vec4f,
        @location(0) color: vec4f
      }

      @vertex
      fn vertex_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.clip_position = vec4f(input.pos, 0.0, 1.0);
        output.color = input.color;
        return output;
      }
    `
  });

  // Fragment Shader Module
  const fragmentShaderModule = device.createShaderModule({
    code: `
      // Duplicate the VertexOutput struct definition
      struct VertexOutput {
        @builtin(position) clip_position: vec4f,
        @location(0) color: vec4f
      }

      @fragment
      fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
        return input.color;
      }
    `
  });

  // Create vertex buffer for grid squares
  let vertices = await createGridVertices(gridStateBuffer, device);
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  // Render Pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'vertex_main',
      buffers: [
        {
          arrayStride: 24, // 2 floats for pos, 4 floats for color
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x4' }
          ]
        }
      ]
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'fragment_main',
      targets: [{ format }]
    },
    primitive: {
      topology: 'triangle-list'
    }
  });
  let animationFrameId: number
  // Render function
  const FRAME_DELAY = 200; 
  let lastUpdateTime = 0;
  async function render(currentTime: number) {
    const elapsedTime = currentTime - lastUpdateTime;

    if (elapsedTime >= FRAME_DELAY) {
      lastUpdateTime = currentTime;
    
      // Compute pass)
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(GRID_COLS / 8), 
        Math.ceil(GRID_ROWS / 8)
      );
      computePass.end();
      // debugBufferCopy(device, nextGridStateBuffer, gridStateArray.length);
      readNextState(nextGridStateBuffer, device, GRID_ROWS, GRID_COLS);
      // Copy nextGridStateBuffer to gridStateBuffer
      commandEncoder.copyBufferToBuffer(
        nextGridStateBuffer, 0,
        gridStateBuffer, 0,
        gridStateBufferSize
      );
  
      // Submit commands
      device.queue.submit([commandEncoder.finish()]);
      // const nextState = await readNextState(nextGridStateBuffer, device, GRID_ROWS, GRID_COLS);
      // device.queue.writeBuffer(gridStateBuffer, 0, nextState);
      // Update vertices based on new grid state
      const vertices = await createGridVertices(gridStateBuffer, device);
      device.queue.writeBuffer(vertexBuffer, 0, vertices);
  
      // Render pass
      const commandEncoder2 = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      };
  
      const renderPass = commandEncoder2.beginRenderPass(renderPassDescriptor);
      renderPass.setPipeline(renderPipeline);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(vertices.length / 6); // 6 vertices per square
      renderPass.end();
  
      // Submit render commands
      device.queue.submit([commandEncoder2.finish()]);
    }
    // Request next animation frame
    animationFrameId = requestAnimationFrame(render);
  }

  // Helper function to create grid vertices
  async function createGridVertices(stateBuffer: GPUBuffer, device: GPUDevice): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        // Map the buffer and read its contents
          // Create a staging buffer to read the state
        const stagingBuffer = device.createBuffer({
          size: GRID_COLS * GRID_ROWS * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        // Create a command encoder to copy buffer contents
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
          stateBuffer, 0,
          stagingBuffer, 0,
          GRID_COLS * GRID_ROWS * 4
        );
      // Submit the commands
      device.queue.submit([commandEncoder.finish()]);
      stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const vertices  = [];
        // Create a mapped buffer to read current state
        const mappedStateBuffer = new Uint32Array(GRID_COLS * GRID_ROWS);
        const copyBuffer = stagingBuffer.getMappedRange();
        mappedStateBuffer.set(new Uint32Array(copyBuffer));
        stagingBuffer.unmap();
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const cellValue = mappedStateBuffer[y * GRID_COLS + x];
            
            // Normalize screen coordinates
            const x1 = (x / GRID_COLS) * 2 - 1;
            const y1 = (y / GRID_ROWS) * 2 - 1;
            const x2 = ((x + 1) / GRID_COLS) * 2 - 1;
            const y2 = ((y + 1) / GRID_ROWS) * 2 - 1;
            
            // Cell color based on state
            const color = cellValue ? [0, 0, 0, 1] : [1, 1, 1, 1];
            
            // Two triangles to form a square
            vertices.push(
              // First triangle
              x1, y1, ...color,
              x2, y1, ...color,
              x1, y2, ...color,
              
              // Second triangle
              x2, y1, ...color,
              x2, y2, ...color,
              x1, y2, ...color
            );
          }
        }
        resolve(new Float32Array(vertices));
      });
    })
  }

  // Start rendering
  await render(performance.now());

  // Return a cancel function to stop rendering
  return () => cancelAnimationFrame(animationFrameId);
};


async function readNextState(stateBuffer: GPUBuffer, device: GPUDevice, rows: number, cols: number): Promise<Uint32Array> {
  return new Promise((resolve, reject) => {
        // Map the buffer and read its contents
          // Create a staging buffer to read the state
          const stagingBuffer = device.createBuffer({
            size: rows * cols,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
  
          // Create a command encoder to copy buffer contents
          const commandEncoder = device.createCommandEncoder();
          commandEncoder.copyBufferToBuffer(
            stateBuffer, 0,
            stagingBuffer, 0,
            rows * cols
          );
        // Submit the commands
        device.queue.submit([commandEncoder.finish()]);
        stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
                  // Create a mapped buffer to read current state
        const mappedStateBuffer = new Uint32Array(cols * rows);
        const copyBuffer = stagingBuffer.getMappedRange();
        mappedStateBuffer.set(new Uint32Array(copyBuffer));
        stagingBuffer.unmap();
        const gridStateArray = new Uint32Array(rows * cols);
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const cellValue = mappedStateBuffer[row * cols + col];
            gridStateArray[row * cols + col] = cellValue
          }
        }
        console.log(gridStateArray);
        resolve(gridStateArray);
      });
  });
}


function generateSquaresBuffer(context: GPUCanvasContext, SQUARE_SIZE_PIXELS: number, scaleDown?: number) {
  const SCALE_DOWN_FACTOR = scaleDown ?? 1;
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


// console.log("calculate ")