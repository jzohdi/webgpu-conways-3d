import { setExampleInURL, setOptions } from "../router";
import { ExampleKeys, examples, isExampleKey } from "../webgpu/experiments";

export function setupDropdown<T>(options: T, onChange: (exampleKey: keyof T) => void): ExampleKeys {
  const dropdown = document.getElementById(
    "example-selector"
  ) as HTMLSelectElement;

  setOptions(examples, dropdown);

  dropdown.addEventListener("change", () => {
    const selectedValue = dropdown.value as keyof T;
    onChange(selectedValue);
  });

  // Preselect the dropdown based on the current URL parameter
  const urlExample = new URLSearchParams(window.location.search).get("example");
  if (urlExample && isExampleKey(urlExample)) {
    dropdown.value = urlExample;
    return urlExample;
  }
  
  const defaultExample: ExampleKeys = "random_triangles_1";

  setExampleInURL(defaultExample);
  dropdown.value = defaultExample;

  return defaultExample;
}
