/// <reference types="vite/client" />

// Allow CSS side-effect imports (required for Leaflet, etc.)
declare module "*.css" {
  const stylesheet: string;
  export default stylesheet;
}
