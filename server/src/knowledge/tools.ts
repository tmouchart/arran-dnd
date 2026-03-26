import type Anthropic from "@anthropic-ai/sdk";
import { Type, type Tool as GeminiTool } from "@google/genai";

export const TOPIC_NAMES = [
  "creation-personnage",
  "combat",
  "equipement",
  "magie",
  "monde-arran",
  "monde-lore-chroniques",
  "monde-lore-peuples-elfes",
  "monde-lore-peuples-nains-humains",
  "monde-lore-peuples-autres",
  "races",
  "voies-de-profil",
  "voies-de-prestige",
  "bestiaire",
] as const;

export type TopicName = (typeof TOPIC_NAMES)[number];

const TOOL_DESCRIPTION =
  "Charge un extrait de règles ou de lore depuis la base de connaissance interne. " +
  "Appelle cet outil dès que la question porte sur un sujet spécifique plutôt que de répondre sans contexte.";

export const anthropicTool: Anthropic.Tool = {
  name: "load_knowledge",
  description: TOOL_DESCRIPTION,
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        enum: [...TOPIC_NAMES],
        description:
          "Le sujet à charger. Valeurs possibles :\n" +
          "- creation-personnage : création de personnage, caractéristiques, profils, voies de départ, PV/DEF/attaques, progression\n" +
          "- combat : tests, difficultés, critiques, déroulé du combat, états préjudiciables, mort, PR, poursuite\n" +
          "- equipement : armes, armures, devises, matériel, montures, poisons, tableaux de prix\n" +
          "- magie : PM, brûlure de magie, talents magiques, compendium des voies magiques\n" +
          "- monde-arran : peuples jouables, modificateurs, traits, aperçu des voies culturelles\n" +
          "- monde-lore-chroniques : histoire du monde (ères, crystaux, Grand Schisme, Fléaux, prophéties) — lore narratif\n" +
          "- monde-lore-peuples-elfes : Elfes par ethnie, Semi-Elfes — lore narratif\n" +
          "- monde-lore-peuples-nains-humains : ordres nains, cultures humaines — lore narratif\n" +
          "- monde-lore-peuples-autres : Orcs, Gobelins, Ogres, Trolls, Centaures — lore narratif\n" +
          "- races : fiches détaillées des peuples/races avec voies culturelles complètes\n" +
          "- voies-de-profil : voies liées aux profils (guerrier, rôdeur, mage, etc.)\n" +
          "- voies-de-prestige : voies de prestige avancées\n" +
          "- bestiaire : fiches complètes des monstres et créatures (stats, attaques, capacités)",
      },
    },
    required: ["topic"],
  },
};

const EDIT_TOOL_DESCRIPTION =
  "Modifie les statistiques du personnage actif. " +
  "N'appelle cet outil QUE si le joueur a explicitement confirmé la modification dans son dernier message.";

export const geminiTool: GeminiTool = {
  functionDeclarations: [
    {
      name: "load_knowledge",
      description: TOOL_DESCRIPTION,
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: {
            type: Type.STRING,
            enum: [...TOPIC_NAMES],
            description:
              "Le sujet à charger. Valeurs possibles :\n" +
              "- creation-personnage : création de personnage, caractéristiques, profils, voies de départ, PV/DEF/attaques, progression\n" +
              "- combat : tests, difficultés, critiques, déroulé du combat, états préjudiciables, mort, PR, poursuite\n" +
              "- equipement : armes, armures, devises, matériel, montures, poisons, tableaux de prix\n" +
              "- magie : PM, brûlure de magie, talents magiques, compendium des voies magiques\n" +
              "- monde-arran : peuples jouables, modificateurs, traits, aperçu des voies culturelles\n" +
              "- monde-lore-chroniques : histoire du monde (ères, crystaux, Grand Schisme, Fléaux, prophéties) — lore narratif\n" +
              "- monde-lore-peuples-elfes : Elfes par ethnie, Semi-Elfes — lore narratif\n" +
              "- monde-lore-peuples-nains-humains : ordres nains, cultures humaines — lore narratif\n" +
              "- monde-lore-peuples-autres : Orcs, Gobelins, Ogres, Trolls, Centaures — lore narratif\n" +
              "- races : fiches détaillées des peuples/races avec voies culturelles complètes\n" +
              "- voies-de-profil : voies liées aux profils (guerrier, rôdeur, mage, etc.)\n" +
              "- voies-de-prestige : voies de prestige avancées\n" +
          "- bestiaire : fiches complètes des monstres et créatures (stats, attaques, capacités)",
          },
        },
        required: ["topic"],
      },
    },
    {
      name: "edit_character",
      description: EDIT_TOOL_DESCRIPTION,
      parameters: {
        type: Type.OBJECT,
        properties: {
          changes: {
            type: Type.OBJECT,
            description: "Champs à modifier. N'inclure QUE les champs qui changent réellement.",
            properties: {
              str:     { type: Type.INTEGER, description: "Force (1-30)" },
              dex:     { type: Type.INTEGER, description: "Dextérité (1-30)" },
              con:     { type: Type.INTEGER, description: "Constitution (1-30)" },
              int:     { type: Type.INTEGER, description: "Intelligence (1-30)" },
              wis:     { type: Type.INTEGER, description: "Sagesse (1-30)" },
              cha:     { type: Type.INTEGER, description: "Charisme (1-30)" },
              level:   { type: Type.INTEGER, description: "Niveau (1-20)" },
              hpMax:   { type: Type.INTEGER, description: "PV maximum" },
              mpMax:   { type: Type.INTEGER, description: "PM maximum" },
              defense: { type: Type.INTEGER, description: "Valeur de défense" },
            },
          },
        },
        required: ["changes"],
      },
    },
  ],
};
