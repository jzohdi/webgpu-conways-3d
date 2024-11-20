export async function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
) {
  const shaderModule = device.createShaderModule({
    code: `
    @vertex
    fn main_vertex(@builtin(vertex_index) VertexIndex : u32)
      -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(0.0, 0.5),
          vec2<f32>(-0.5, -0.5),
          vec2<f32>(0.5, -0.5)
        );
        return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
      }

    @fragment
    fn main_fragment() -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 0.0, 0.0, 1.0);
    }
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "main_vertex",
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
