/**
 * Test de la reponse d'erreur de SECOURS du routeur (T1/audit).
 *
 * Le routeur (client.ts handleInteraction) est appele via `void handleInteraction(...)` :
 * un rejet non capture dans la reponse d'erreur de secours devient un unhandledRejection
 * (crash Node / bruit Bun) et le feedback est perdu. `repondreErreurRouteur` GARDE ce
 * reply/followUp dans son propre try/catch : il LOG l'echec sans jamais rejeter.
 */
import { describe, expect, it } from "bun:test";
import { repondreErreurRouteur } from "./router-error";

interface FakeInteraction {
  replied: boolean;
  deferred: boolean;
  reply(): Promise<unknown>;
  followUp(): Promise<unknown>;
}

describe("repondreErreurRouteur", () => {
  it("interaction fraiche -> reply", async () => {
    let via = "";
    const interaction: FakeInteraction = {
      replied: false,
      deferred: false,
      reply: () => {
        via = "reply";
        return Promise.resolve();
      },
      followUp: () => {
        via = "followUp";
        return Promise.resolve();
      },
    };
    await repondreErreurRouteur(interaction as never, "ping", () => {});
    expect(via).toBe("reply");
  });

  it("interaction deja acquittee -> followUp", async () => {
    let via = "";
    const interaction: FakeInteraction = {
      replied: true,
      deferred: false,
      reply: () => {
        via = "reply";
        return Promise.resolve();
      },
      followUp: () => {
        via = "followUp";
        return Promise.resolve();
      },
    };
    await repondreErreurRouteur(interaction as never, "ping", () => {});
    expect(via).toBe("followUp");
  });

  it("un reply de secours qui REJETTE (10062/40060) ne propage pas et est LOGGE", async () => {
    const logs: unknown[] = [];
    const interaction: FakeInteraction = {
      replied: false,
      deferred: false,
      reply: () => Promise.reject(new Error("Unknown interaction")),
      followUp: () => Promise.resolve(),
    };
    // Ne DOIT PAS rejeter (sinon unhandledRejection en prod via `void handleInteraction`).
    await repondreErreurRouteur(interaction as never, "rename", (m, err) => logs.push([m, err]));
    expect(logs.length).toBe(1);
  });

  it("un followUp de secours qui REJETTE ne propage pas non plus", async () => {
    const logs: unknown[] = [];
    const interaction: FakeInteraction = {
      replied: true,
      deferred: false,
      reply: () => Promise.resolve(),
      followUp: () => Promise.reject(new Error("Interaction has already been acknowledged")),
    };
    await repondreErreurRouteur(interaction as never, "rename", (m, err) => logs.push([m, err]));
    expect(logs.length).toBe(1);
  });
});
