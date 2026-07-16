/**
 * L'adapter en memoire doit honorer le contrat du port GuildSettingsStore (socle).
 * C'est le defaut de ReNamioos quand aucune DATABASE_URL n'est fournie.
 */
import { contratGuildSettingsStore } from "./store.contract";
import { creerMemoryGuildSettingsStore } from "./memory-store";

contratGuildSettingsStore("memory", async () => creerMemoryGuildSettingsStore());
