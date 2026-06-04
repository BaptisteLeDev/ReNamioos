/**
 * Test d'acceptation de /aide.
 *
 * Successeur de aide_slash (bot.py:399). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : annonce "9 styles" (le legacy disait "8 styles" en dur et
 * omettait scriptify). Le nombre est DERIVE de STYLE_NAMES, pas un litteral.
 *
 * Mock Discord a la frontiere uniquement.
 */
import { describe, expect, it } from 'bun:test';
import { STYLE_NAMES } from '../domain/styles';
import { aideCommand } from './aide';

function fakeInteraction() {
  const captured: { embeds: { data: { fields?: { value: string }[] } }[] } = { embeds: [] };
  return {
    interaction: {
      reply: (payload: { embeds?: never[] }) => {
        captured.embeds = (payload.embeds ?? []) as never;
        return Promise.resolve();
      },
    } as never,
    captured,
  };
}

describe('commande /aide', () => {
  it('se nomme "aide" et a une description', () => {
    expect(aideCommand.data.name).toBe('aide');
    expect(aideCommand.data.description.length).toBeGreaterThan(0);
  });

  it('annonce le nombre REEL de styles (9, derive du domaine)', async () => {
    const { interaction, captured } = fakeInteraction();
    await aideCommand.execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join('\n');
    expect(texte).toContain(`${STYLE_NAMES.length} styles`);
    expect(STYLE_NAMES.length).toBe(9); // garde-fou : la decision B4 est bien 9
  });

  it('liste les commandes publiques', async () => {
    const { interaction, captured } = fakeInteraction();
    await aideCommand.execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join('\n');
    for (const cmd of ['/styles', '/convert', '/rename', '/random', '/ping']) {
      expect(texte).toContain(cmd);
    }
  });
});
