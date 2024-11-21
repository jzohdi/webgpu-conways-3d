export function setupDropdown(onChange: (exampleKey: string) => void) {
  const dropdown = document.getElementById(
    "example-selector"
  ) as HTMLSelectElement;

  dropdown.addEventListener("change", () => {
    const selectedValue = dropdown.value;
    onChange(selectedValue);
  });

  // Preselect the dropdown based on the current URL parameter
  const urlExample = new URLSearchParams(window.location.search).get("example");
  if (urlExample) {
    dropdown.value = urlExample;
  }
}
