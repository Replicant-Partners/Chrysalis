/// <reference types="vite/client" />
/// <reference types="vitest" />

// CSS Modules type declarations
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}