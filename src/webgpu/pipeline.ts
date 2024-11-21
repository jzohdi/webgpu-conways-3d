export async function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
) {
  const shaderModule = device.createShaderModule({
    code: `
			@vertex
			fn main_vertex(
				@location(0) position: vec2<f32>,       // Unit square vertex positions
				@location(1) instancePosSize: vec4<f32> // Per-instance [x, y, width, height]
			) -> @builtin(position) vec4<f32> {
				let pos = position * instancePosSize.zw + instancePosSize.xy; // Scale and translate
				return vec4<f32>(pos, 0.0, 1.0);
			}

			@fragment
			fn main_fragment() -> @location(0) vec4<f32> {
				return vec4<f32>(0.0, 1.0, 0.0, 1.0); // Green color
			}
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "main_vertex",
      buffers: [
        {
          arrayStride: 2 * 4, // Each vertex has 2 floats (x, y)
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" }, // Vertex positions
          ],
        },
        {
          arrayStride: 4 * 4, // Each instance has 4 floats (x, y, width, height)
          stepMode: "instance", // Step per instance
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x4" }, // Instance data
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

  return pipeline;
}
