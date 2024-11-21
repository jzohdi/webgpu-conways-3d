# WebGPU Conways 3D

Just for fun. This is an experpimental project for the purpose of learning webgpu APIs.

## TODO

1. Make the drop down list logic wayyy better.

## Setup steps taken

`npm create vite@latest`

### Types for WebGPU

`npm install @webgpu/types --save-dev`

`tsonfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "types": ["@webgpu/types"], // Add this line
    "lib": ["DOM", "ESNext"] // Include DOM for browser-specific APIs
  },
  "include": ["src/**/*"]
}
```

### Check Your Browser Support

The TypeScript types for WebGPU (@webgpu/types) align with the browser implementation. If your browser's WebGPU API is outdated or experimental:

Ensure you are using the latest version of Chrome, Edge, or Firefox Nightly.
Enable experimental features if necessary:
In Chrome, navigate to chrome://flags and enable WebGPU.

## Errors

Here I am keeping a log of errors encountered and how they were fixed.

### Layout

#### Fix

```txt
Argument of type '{ vertex: { module: GPUShaderModule; entryPoint: string; }; fragment: { module: GPUShaderModule; entryPoint: string; targets: { format: GPUTextureFormat; }[]; }; primitive: { ...; }; }' is not assignable to parameter of type 'GPURenderPipelineDescriptor'.
  Property 'layout' is missing in type '{ vertex: { module: GPUShaderModule; entryPoint: string; }; fragment: { module: GPUShaderModule; entryPoint: string; targets: { format: GPUTextureFormat; }[]; }; primitive: { ...; }; }' but required in type 'GPURenderPipelineDescriptor'.ts(2345)
```

Fix: Add the layout Property to the Pipeline Descriptor
You have two options for specifying the layout:

1. Explicit Layout
Define a GPUPipelineLayout explicitly using device.createPipelineLayout():

```typescript
const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [],
});

const pipeline = device.createRenderPipeline({
  layout: pipelineLayout, // Explicit layout
  vertex: {
    module: shaderModule,
    entryPoint: 'main_vertex',
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'main_fragment',
    targets: [{ format }],
  },
  primitive: {
    topology: 'triangle-list',
  },
});
```

Use this approach when you plan to bind resources (e.g., buffers or textures) later using bind groups.

2. Auto Layout

Let WebGPU infer the layout by setting layout: "auto":

```typescript
const pipeline = device.createRenderPipeline({
  layout: 'auto', // Let WebGPU infer the layout
  vertex: {
    module: shaderModule,
    entryPoint: 'main_vertex',
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'main_fragment',
    targets: [{ format }],
  },
  primitive: {
    topology: 'triangle-list',
  },
});
```

This is sufficient for simple pipelines where no resource binding is required.

When to Use Explicit Layout
Use an explicit layout if your application will:
Bind resources (e.g., uniforms, textures, samplers) using bind groups.
Require advanced pipeline configuration with multiple bind groups.
For now, layout: 'auto' is sufficient for learning and simple rendering tasks.

Bonus: Debugging TypeScript Errors
If errors persist, double-check that:

WebGPU Types: Ensure @webgpu/types is installed and up-to-date.
TypeScript Version: Use TypeScript 4.4 or higher:
bash
