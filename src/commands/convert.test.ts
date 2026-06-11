/**
 * Test d'acceptation de /convert <texte> <style>.
 *
 * Successeur de convert_slash (bot.py:218). Adapter pur : extrait texte+style,
 * appelle le domaine (convertirTexte), repose le resultat. ÉCART VOLONTAIRE
 * (B4, ADR-0003 decision 3) : le domaine renvoie un Result -> l'erreur metier
 * (style inconnu, rien a styliser/deja stylise) est traduite en message
 * ephemere ; aucun rendu fantaisiste.
 *
 * Mock Discord a la frontiere uniquement : le domaine reste sans mock.
 */
import { describe, expect, it } from 'bun:test';
import { convertCommand } from './convert';

interface Captured {
  embeds: { data: { fields?: { name: string; value: string }[] } }[];
  content: string;
  ephemeral: boolean;
}

/** Double : interaction avec options string (texte/style) et reply capturee. */
function fakeInteraction(opts: { texte: string; style: string }) {
  const captured: Captured = { embeds: [], content: '', ephemeral: false };
  const interaction = {
    options: {
      getString: (name: string, _required?: boolean) =>
        name === 'texte' ? opts.texte : opts.style,
    },
    reply: (payload: { embeds?: never[]; content?: string; ephemeral?: boolean }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.content = payload.content ?? '';
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe('commande /convert', () => {
  it('se nomme "convert" et a une description', () => {
    expect(convertCommand.data.name).toBe('convert');
    expect(convertCommand.data.description.length).toBeGreaterThan(0);
  });

  it('stylise un texte et repond un embed (Original + Resultat)', async () => {
    const { interaction, captured } = fakeInteraction({ texte: 'abc', style: 'cursive' });
    await convertCommand.execute(interaction);
    expect(captured.embeds.length).toBe(1);
    const fields = captured.embeds[0]?.data.fields ?? [];
    const valeurs = fields.map((f) => f.value).join(' ');
    expect(valeurs).toContain('abc'); // original repris
    expect(valeurs).toContain('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬 (resultat stylise)
  });

  it('style inconnu -> message ephemere, aucun embed', async () => {
    const { interaction, captured } = fakeInteraction({ texte: 'abc', style: 'inexistant' });
    await convertCommand.execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('inconnu');
  });

  it('texte deja stylise -> refus propre ephemere ("deja stylise")', async () => {
    const dejaStylise = '\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ texte: dejaStylise, style: 'cursive' });
    await convertCommand.execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('déjà stylisé');
  });

  // Finding #24 (CWE-20) : texte non borne injecte dans l'embed. Au-dela de la
  // limite, refus propre ephemere, aucun embed (pas d'injection de payload geant).
  it('texte trop long -> refus ephemere, aucun embed (finding #24)', async () => {
    const tropLong = 'a'.repeat(501);
    const { interaction, captured } = fakeInteraction({ texte: tropLong, style: 'cursive' });
    await convertCommand.execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('trop long');
  });

  it('texte a la limite (500) -> stylise normalement', async () => {
    const limite = 'a'.repeat(500);
    const { interaction, captured } = fakeInteraction({ texte: limite, style: 'cursive' });
    await convertCommand.execute(interaction);
    expect(captured.embeds.length).toBe(1);
  });
});
