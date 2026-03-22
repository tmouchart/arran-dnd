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
          "- voies-de-prestige : voies de prestige avancées",
      },
    },
    required: ["topic"],
  },
};

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
              "- voies-de-prestige : voies de prestige avancées",
          },
        },
        required: ["topic"],
      },
    },
  ],
};
