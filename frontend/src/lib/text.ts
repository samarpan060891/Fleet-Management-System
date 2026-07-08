// Turns a raw enum/slug value ("truck_3_7t", "in-workshop") into a capitalized
// display label ("Truck 3 7t", "In Workshop"). Used anywhere a raw stored
// value (dropdown option, chip, status) is shown to the user.
export function titleCase(s: string): string {
  return String(s)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
