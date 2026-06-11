/**
 * Test d'acceptation de /preview <style> [texte] (#26).
 *
 * Apercu PERSONNEL et EPHEMERE d'un style : ne renomme personne, ne touche pas au
 * serveur, n'exige AUCUNE permission. Source = le texte fourni, sinon le pseudo de
 * l'appelant (membre.nickname ?? user.username). Reutilise le domaine (convertirTexte)
 * et les helpers existants (estStyleConnu, messageErreur). Toujours ephemeral.
 *
 * Mock Discord A LA FRONTIERE uniquement ; le domaine reste sans mock.
 */
import { describe, expect, it } from 'bun:test';
import { previewCommand } from './preview';

interface Captured {
  embeds: { data: { fields?: { name: string; value: string }[]; title?: string } }[];
  content: string;
  ephemeral: boolean;
}

/** Double : interaction /preview avec options (style requis, texte optionnel) et appelant. */
function fakeInteraction(opts: { style: string; texte?: string | null; nickname?: string | null; username?: string }) {
  const captured: Captured = { embeds: [], content: '', ephemeral: false };
  const interaction = {
    member: { nickname: opts.nickname ?? null },
    user: { username: opts.username ?? 'AppelantDefaut' },
    options: {
      getString: (name: string, _required?: boolean) =>
        name === 'style' ? opts.style : (opts.texte ?? null),
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

describe('commande /preview', () => {
  it('se nomme "preview" et a une description', () => {
    expect(previewCommand.data.name).toBe('preview');
    expect(previewCommand.data.description.length).toBeGreaterThan(0);
  });

  it('n’exige aucune permission (default_member_permissions non defini)', () => {
    const json = previewCommand.data.toJSON();
    expect(json.default_member_permissions ?? null).toBeNull();
  });

  it('style requis, texte optionnel', () => {
    const json = previewCommand.data.toJSON();
    const style = (json.options ?? []).find((o) => o.name === 'style');
    const texte = (json.options ?? []).find((o) => o.name === 'texte');
    expect(style?.required).toBe(true);
    expect(texte?.required ?? false).toBe(false);
  });

  it('texte fourni -> apercu stylise EPHEMERE, sans renommer', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'cursive', texte: 'abc' });
    await previewCommand.execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.embeds.length).toBe(1);
    const valeurs = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join(' ');
    expect(valeurs).toContain('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
  });

  it('sans texte -> utilise le nickname serveur de l’appelant', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'cursive', nickname: 'Bob', username: 'bob_global' });
    await previewCommand.execute(interaction);
    const valeurs = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join(' ');
    expect(valeurs).toContain('Bob'); // original = nickname serveur
  });

  it('sans texte ni nickname -> retombe sur le username global', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'cursive', nickname: null, username: 'bob_global' });
    await previewCommand.execute(interaction);
    const valeurs = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join(' ');
    expect(valeurs).toContain('bob_global');
  });

  it('style inconnu -> message ephemere, aucun embed', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'inexistant', texte: 'abc' });
    await previewCommand.execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('inconnu');
  });

  it('texte deja stylise -> refus propre ephemere', async () => {
    const dejaStylise = '\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ style: 'cursive', texte: dejaStylise });
    await previewCommand.execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('déjà stylisé');
  });
});
