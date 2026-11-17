import type { MetadataRoute } from "next";

/** App instalable (D-119): se abre a pantalla completa desde el ícono, sin barra del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal OS",
    short_name: "Personal OS",
    description: "Trabajo, hábitos, salud, finanzas y vida personal en un solo lugar.",
    lang: "es",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0c1517",
    theme_color: "#0a1416",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Panel", url: "/dashboard" },
      { name: "Avisos", url: "/notices" },
      { name: "Registrar entrenamiento", url: "/fitness?nuevo=entrenamiento" },
    ],
  };
}
