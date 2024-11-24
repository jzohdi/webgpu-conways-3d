export async function main(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
): Promise<() => void> {
  const SQUARE_SIZE_PIXELS = 20; // Each square is 20x20 pixels
  let instanceCount: number;
  let GRID_ROWS: number;
  let GRID_COLS: number;
  let CELL_SIZE: number;
  const SCALE_DOWN_FACTOR = 10;

  let gridState: number[][]; // 2D array to track the current state (1 = black, 0 = white)

  function calculateGrid() {
    const canvasWidth = context.canvas.width;
    const canvasHeight = context.canvas.height;
  
  // Calculate the number of squares that fit horizontally and vertically
  const squaresAcrossWidth = Math.floor(canvasWidth / (SQUARE_SIZE_PIXELS / SCALE_DOWN_FACTOR)); 
  const squaresAcrossHeight = Math.floor(canvasHeight / (SQUARE_SIZE_PIXELS / SCALE_DOWN_FACTOR));
  
    // Set the grid dimensions based on the smaller dimension
    GRID_COLS = squaresAcrossWidth;
    GRID_ROWS = squaresAcrossHeight;
  
    // Calculate CELL_SIZE based on the smaller dimension in normalized device coordinates
    const canvasAspectRatio = canvasWidth / canvasHeight;
    if (canvasAspectRatio > 1) {
      // Landscape orientation
      CELL_SIZE = 2 / GRID_ROWS; // Fit squares by height
    } else {
      // Portrait or square orientation
      CELL_SIZE = 2 / GRID_COLS; // Fit squares by width
    }
  
    // Initialize the grid state (random black/white squares)
    gridState = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => (Math.random() < 0.35 ? 1 : 0))
    );
  
    // Update the total instance count
    instanceCount = GRID_ROWS * GRID_COLS;
  }

  calculateGrid(); // Calculate grid initially

  let positionScaleBuffer: GPUBuffer;
  let colorBuffer: GPUBuffer;

  function createBuffers() {
    const positionScaleData = new Float32Array(instanceCount * 4); // [x, y, scaleX, scaleY]
    const colorData = new Float32Array(instanceCount * 3); // [r, g, b]

    let index = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = (col - GRID_COLS / 2 + 0.5) * CELL_SIZE;
        const y = (row - GRID_ROWS / 2 + 0.5) * CELL_SIZE;

        positionScaleData[index * 4 + 0] = x; // x position
        positionScaleData[index * 4 + 1] = y; // y position
        positionScaleData[index * 4 + 2] = CELL_SIZE; // scaleX
        positionScaleData[index * 4 + 3] = CELL_SIZE; // scaleY

        const isBlack = gridState[row][col] === 1;
        colorData[index * 3 + 0] = isBlack ? 0.0 : 1.0; // r
        colorData[index * 3 + 1] = isBlack ? 0.0 : 1.0; // g
        colorData[index * 3 + 2] = isBlack ? 0.0 : 1.0; // b

        index++;
      }
    }

    positionScaleBuffer = device.createBuffer({
      size: positionScaleData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(positionScaleBuffer.getMappedRange()).set(positionScaleData);
    positionScaleBuffer.unmap();

    colorBuffer = device.createBuffer({
      size: colorData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Allow updates
      mappedAtCreation: true,
    });
    new Float32Array(colorBuffer.getMappedRange()).set(colorData);
    colorBuffer.unmap();
  }

  createBuffers(); // Create buffers initially

  const unitSquareVertices = new Float32Array([
    -0.5, 0.5,  0.5, 0.5, -0.5, -0.5, // Triangle 1
    -0.5, -0.5, 0.5, 0.5,  0.5, -0.5, // Triangle 2
  ]);

  const vertexBuffer = device.createBuffer({
    size: unitSquareVertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(unitSquareVertices);
  vertexBuffer.unmap();

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

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'main_vertex',
      buffers: [
        {
          arrayStride: 2 * 4,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        },
        {
          arrayStride: 4 * 4,
          stepMode: 'instance',
          attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
        },
        {
          arrayStride: 3 * 4,
          stepMode: 'instance',
          attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }],
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

  function updateGrid() {
    const nextGridState = gridState.map((row) => [...row]);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        let blackNeighborCount = 0;

        // Check all neighbors
        for (let yOffset = -1; yOffset <= 1; yOffset++) {
          for (let xOffset = -1; xOffset <= 1; xOffset++) {
            if (yOffset === 0 && xOffset === 0) continue; // Skip the square itself

            const neighborRow = row + yOffset;
            const neighborCol = col + xOffset;

            if (
              neighborRow >= 0 &&
              neighborRow < GRID_ROWS &&
              neighborCol >= 0 &&
              neighborCol < GRID_COLS
            ) {
              blackNeighborCount += gridState[neighborRow][neighborCol];
            }
          }
        }

        // Apply rules
        const isBlack = gridState[row][col] === 1;
        if (isBlack) {
          if (blackNeighborCount < 2 || blackNeighborCount > 3) {
            nextGridState[row][col] = 0; // Becomes white
          }
        } else {
          if (blackNeighborCount === 3) {
            nextGridState[row][col] = 1; // Becomes black
          }
        }
      }
    }

    // Update the current grid state
    gridState = nextGridState;

    // Update the color buffer
    const colorData = new Float32Array(instanceCount * 3);
    let index = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isBlack = gridState[row][col] === 1;
        colorData[index * 3 + 0] = isBlack ? 0.0 : 1.0;
        colorData[index * 3 + 1] = isBlack ? 0.0 : 1.0;
        colorData[index * 3 + 2] = isBlack ? 0.0 : 1.0;
        index++;
      }
    }

    device.queue.writeBuffer(colorBuffer, 0, colorData);
  }

  let animationFrameId: number;
  let lastUpdateTime = 0; // Track the last time the grid was updated
  const FRAME_DELAY = 50; // Delay in milliseconds between updates (e.g., 200ms)
  
  function render(currentTime: number) {
    const elapsedTime = currentTime - lastUpdateTime;
  
    if (elapsedTime >= FRAME_DELAY) {
      updateGrid(); // Update the grid only if enough time has passed
      lastUpdateTime = currentTime;
    }
    const commandEncoder = device.createCommandEncoder();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 },
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setVertexBuffer(1, positionScaleBuffer);
    passEncoder.setVertexBuffer(2, colorBuffer);
    passEncoder.draw(6, instanceCount, 0, 0);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    animationFrameId = requestAnimationFrame(render);
  }
  // let animationFrameId: number;
  // let lastUpdateTime = 0; // Track the last time the grid was updated
  // const FRAME_DELAY = 50; // Delay in milliseconds between updates (e.g., 200ms)
  // function render(currentTime: number) {
  //   const elapsedTime = currentTime - lastUpdateTime;

  //   if (elapsedTime >= FRAME_DELAY) {
  //     updateGrid(); // Update the grid only if enough time has passed
  //     lastUpdateTime = currentTime;
  //   }
  
  //   const commandEncoder = device.createCommandEncoder();
  //   const renderPassDescriptor: GPURenderPassDescriptor = {
  //     colorAttachments: [
  //       {
  //         view: context.getCurrentTexture().createView(),
  //         loadOp: 'clear',
  //         storeOp: 'store',
  //         clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 },
  //       },
  //     ],
  //   };

  //   const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  //   passEncoder.setPipeline(pipeline);
  //   passEncoder.setVertexBuffer(0, vertexBuffer);
  //   passEncoder.setVertexBuffer(1, positionScaleBuffer);
  //   passEncoder.setVertexBuffer(2, colorBuffer);
  //   passEncoder.draw(6, instanceCount, 0, 0);
  //   passEncoder.end();

  //   device.queue.submit([commandEncoder.finish()]);
  //   animationFrameId = requestAnimationFrame(render);
  // }
  render(new Date().getMilliseconds());

  return () => cancelAnimationFrame(animationFrameId);
}
