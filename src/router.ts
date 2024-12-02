import { ExampleKeys, ExampleRecord, isExampleKey } from "./webgpu/experiments";

export function getExampleFromURL(): ExampleKeys | null {
  const params = new URLSearchParams(window.location.search);
  const exampleKey = params.get("example");
  if (isExampleKey(exampleKey)) {
      return exampleKey;
  }
  return "random_triangles_1";
}

export function setExampleInURL(exampleKey: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("example", exampleKey);
  window.history.replaceState({}, "", `?${params.toString()}`);
}

export function setOptions(examples: ExampleRecord, selectElement: HTMLSelectElement) {
  Object.entries(examples).forEach(([key, entry]) => {
    const newOption = document.createElement("option");
    newOption.setAttribute("value", key);
    newOption.innerText = entry.label;
    selectElement.appendChild(newOption);
  })
}