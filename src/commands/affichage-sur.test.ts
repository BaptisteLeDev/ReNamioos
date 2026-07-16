/**
 * Test du helper d'affichage SUR de contenu tiers (issue #45, reutilise par les menus
 * contextuels). Un message d'autrui peut contenir du markdown et des mentions hostiles :
 * ce helper neutralise le rendu (echappement markdown + cassure des mentions) AVANT de
 * l'inserer dans un embed ephemere. Pur : aucun client Discord, testable en memoire.
 */
import { describe, expect, it } from "bun:test";
import { neutraliserAffichage } from "./affichage-sur";

describe("neutraliserAffichage", () => {
  it("echappe le markdown actif (gras, italique, spoiler, code)", () => {
    const sortie = neutraliserAffichage("**gras** _ital_ ||spoil|| `code`");
    expect(sortie).not.toContain("**gras**");
    expect(sortie).toContain("\\*\\*gras\\*\\*");
  });

  it("casse @everyone et @here (plus de ping possible)", () => {
    const sortie = neutraliserAffichage("coucou @everyone et @here");
    expect(sortie).not.toContain("@everyone");
    expect(sortie).not.toContain("@here");
    // Le texte reste LISIBLE (le mot subsiste, seule la sequence de ping est cassee).
    expect(sortie).toContain("everyone");
    expect(sortie).toContain("here");
  });

  it("casse les mentions de membre / role / salon (<@id>, <@&id>, <#id>)", () => {
    const sortie = neutraliserAffichage("<@123> <@&456> <#789>");
    expect(sortie).not.toContain("<@123>");
    expect(sortie).not.toContain("<@&456>");
    expect(sortie).not.toContain("<#789>");
  });

  it("laisse un texte ordinaire intact", () => {
    expect(neutraliserAffichage("Bonjour le monde")).toBe("Bonjour le monde");
  });
});
