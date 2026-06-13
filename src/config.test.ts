/**
 * Durcissement de la configuration au boot (issue #37, SEC-001 / SEC-003).
 *
 * SEC-001 (CWE-306/200) : un bind NON-loopback (l'API exposee au-dela de 127.0.0.1)
 * SANS token >= 32 octets ouvre /stats sans auth. La config doit REFUSER ce cas au
 * boot (echec fort, aucun demarrage degrade). Sur loopback, le token reste optionnel
 * (retro-compat dev). SEC-003 : si fourni, STATS_TOKEN doit faire >= 32 octets.
 *
 * On valide la POLITIQUE pure (loadConfig leve une erreur), sans I/O : provenance de
 * la config centralisee dans un seul module (mandat ARCHITECTURE.md).
 */
import { describe, expect, it } from 'bun:test';
import { loadConfig } from './config';

const baseEnv = {
  DISCORD_TOKEN: 'token-discord',
  DISCORD_APPLICATION_ID: 'app-id',
  NODE_ENV: 'production',
} as const;

const token32 = 'a'.repeat(32);

describe('config — bind & token /stats (issue #37)', () => {
  it('defaut HOST = 127.0.0.1 (loopback, non expose)', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.api.host).toBe('127.0.0.1');
  });

  it('REFUSE un bind non-loopback sans STATS_TOKEN (SEC-001)', () => {
    expect(() => loadConfig({ ...baseEnv, HOST: '0.0.0.0' })).toThrow();
  });

  it('REFUSE un bind non-loopback avec STATS_TOKEN < 32 octets (SEC-001)', () => {
    expect(() => loadConfig({ ...baseEnv, HOST: '0.0.0.0', STATS_TOKEN: 'court' })).toThrow();
  });

  it('ACCEPTE un bind non-loopback avec STATS_TOKEN >= 32 octets', () => {
    const config = loadConfig({ ...baseEnv, HOST: '0.0.0.0', STATS_TOKEN: token32 });
    expect(config.api.host).toBe('0.0.0.0');
    expect(config.api.statsToken).toBe(token32);
  });

  it('ACCEPTE un bind loopback sans token (retro-compat dev)', () => {
    const config = loadConfig({ ...baseEnv, HOST: '127.0.0.1' });
    expect(config.api.statsToken).toBeUndefined();
  });

  it('REFUSE un STATS_TOKEN < 32 octets meme sur loopback (SEC-003)', () => {
    expect(() => loadConfig({ ...baseEnv, HOST: '127.0.0.1', STATS_TOKEN: 'court' })).toThrow();
  });

  it('traite ::1 comme loopback (IPv6)', () => {
    const config = loadConfig({ ...baseEnv, HOST: '::1' });
    expect(config.api.host).toBe('::1');
  });
});

describe('config — auto-deploiement des commandes (#40)', () => {
  it('DEFAUT true quand DISCORD_AUTO_DEPLOY_COMMANDS est absent', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.discord.autoDeployCommands).toBe(true);
  });

  it("seul 'false' (insensible a la casse) desactive", () => {
    expect(loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: 'false' }).discord.autoDeployCommands).toBe(false);
    expect(loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: 'FALSE' }).discord.autoDeployCommands).toBe(false);
  });

  it("toute autre valeur ('true', '1', vide) reste activee", () => {
    expect(loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: 'true' }).discord.autoDeployCommands).toBe(true);
    expect(loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: '1' }).discord.autoDeployCommands).toBe(true);
    expect(loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: '' }).discord.autoDeployCommands).toBe(true);
  });
});
