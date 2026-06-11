// @ts-check
import { defineConfig } from "astro/config";

// Landing page ReNamioos.
// Le build statique est écrit DANS ../website (committé au dépôt) pour un
// déploiement Vercel ultérieur (output: "static", dossier servi tel quel).
export default defineConfig({
  site: "https://renamioos.botdiscordfactory.com",
  outDir: "../website",
  build: {
    // Le dossier de sortie est versionné : on ne le vide pas silencieusement,
    // mais Astro le régénère à chaque build. assets dans _astro/ comme par défaut.
    assets: "_astro",
  },
});
