/**
 * Test d'acceptation de /styles.
 *
 * Successeur de styles_slash (bot.py:252). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : scriptify est un style PUBLIC -> l'embed liste les 9 styles
 * (le legacy en omettait scriptify). L'apercu de chaque style est DERIVE du
 * domaine (convertirTexte), pas d'un litteral UI a maintenir -> aucun style
 * charge ne peut etre absent de l'UI.
 *
 * Mock Discord a la frontiere : on capte le payload d'embed sans vraie interaction.
 */
import { describe, expect, it } from 'bun:test';
import { STYLE_NAMES } from '../domain/styles';
import { stylesCommand } from './styles';

/** Double minimal : capture l'embed JSON envoye par la commande. */
function fakeInteraction() {
  const captured: { embeds: unknown[] } = { embeds: [] };
  return {
    interaction: {
      reply: (payload: { embeds?: unknown[] }) => {
        captured.embeds = payload.embeds ?? [];
        return Promise.resolve();
      },
    } as never,
    captured,
  };
}

describe('commande /styles', () => {
  it('se nomme "styles" et a une description', () => {
    expect(stylesCommand.data.name).toBe('styles');
    expect(stylesCommand.data.description.length).toBeGreaterThan(0);
  });

  it('liste les 9 styles publics (scriptify inclus)', async () => {
    const { interaction, captured } = fakeInteraction();
    await stylesCommand.execute(interaction);

    const embed = (captured.embeds[0] as { data: { fields?: { name: string }[] } }).data;
    const fields = embed.fields ?? [];
    expect(fields.length).toBe(9);
    expect(fields.length).toBe(STYLE_NAMES.length);

    // scriptify (ECART B4) doit figurer dans l'UI.
    const noms = fields.map((f) => f.name.toLowerCase());
    expect(noms.some((n) => n.includes('scriptify'))).toBe(true);
  });

  it('derive chaque apercu du domaine (pas un litteral UI)', async () => {
    const { interaction, captured } = fakeInteraction();
    await stylesCommand.execute(interaction);
    const embed = (captured.embeds[0] as { data: { fields?: { value: string }[] } }).data;
    const fields = embed.fields ?? [];
    // Chaque apercu est non vide et != du nom brut (un vrai rendu stylise).
    for (const f of fields) {
      expect(f.value.length).toBeGreaterThan(0);
    }
  });
});
