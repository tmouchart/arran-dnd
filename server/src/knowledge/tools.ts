import type Anthropic from "@anthropic-ai/sdk";
import { Type, type FunctionDeclaration, type Tool as GeminiTool } from "@google/genai";

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

const EDIT_TOOL_DESCRIPTION =
  "Modifie les statistiques du personnage actif. " +
  "N'appelle cet outil QUE si le joueur a explicitement confirmé la modification dans son dernier message.";

/** Outils disponibles pour tout le monde. */
const COMMON_DECLARATIONS: FunctionDeclaration[] = [
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
  {
    name: "get_page",
    description:
      "Lit le contenu complet d'une page partagée par son identifiant. " +
      "La liste des pages (id + titre) est dans le contexte, section Pages partagées : " +
      "utilise cet outil dès qu'un titre semble pertinent pour la question.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: {
          type: Type.INTEGER,
          description: "Identifiant de la page à lire.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "generate_image",
    description:
      "Génère une illustration (scène, portrait, carte, objet) en rapport avec les Terres d'Arran. " +
      "Utilise cet outil quand le joueur demande une illustration ou quand une description visuelle enrichirait la conversation. " +
      "Ne l'utilise PAS pour les questions de règles ou de mécanique.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            "Description détaillée de l'image à générer, en anglais, style medieval fantasy. " +
            "Inclure : sujet, cadrage, ambiance, palette de couleurs, style artistique.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_character",
    description:
      "Récupère la fiche complète d'un compagnon de campagne par son prénom " +
      "(profil, stats, voies, compétences, portrait). " +
      "RÈGLE : avant de générer une image représentant un ou plusieurs personnages joueurs, " +
      "appelle TOUJOURS get_character sur chaque personnage concerné pour obtenir son portrait et son apparence.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Le prénom du personnage à consulter (tel qu'affiché dans la liste des compagnons).",
        },
      },
      required: ["name"],
    },
  },
];

/** Réservé au MJ : la fiche chiffrée d'un monstre n'est jamais exposée à un joueur. */
const GET_MONSTRE_DECLARATION: FunctionDeclaration = {
  name: "get_monstre",
  description:
    "Lit la fiche complète d'une créature du bestiaire (NC, taille, DEF, PV, initiative, caractéristiques, attaques, capacités). " +
    "Le nom doit être l'un de ceux de l'index du bestiaire fourni dans le contexte. " +
    "Appelle cet outil dès qu'une question porte sur une créature précise.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      nom: {
        type: Type.STRING,
        description: "Le nom de la créature, tel qu'il figure dans l'index du bestiaire.",
      },
    },
    required: ["nom"],
  },
};

function declarations(isGm: boolean): FunctionDeclaration[] {
  return isGm ? [...COMMON_DECLARATIONS, GET_MONSTRE_DECLARATION] : COMMON_DECLARATIONS;
}

export function buildGeminiTool(isGm: boolean): GeminiTool {
  return { functionDeclarations: declarations(isGm) };
}

/** Les schémas Gemini (`Type.OBJECT`) et JSON Schema (`"object"`) ne diffèrent que par la casse du champ `type`. */
function toJsonSchema(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "type" && typeof value === "string") {
      out[key] = value.toLowerCase();
    } else if (key === "properties" && value !== null && typeof value === "object") {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toJsonSchema(v)])
      );
    } else if (key === "items") {
      out[key] = toJsonSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function buildAnthropicTools(isGm: boolean): Anthropic.Tool[] {
  return declarations(isGm).map((d) => ({
    name: d.name ?? "",
    description: d.description ?? "",
    input_schema: toJsonSchema(d.parameters ?? { type: Type.OBJECT, properties: {} }) as Anthropic.Tool.InputSchema,
  }));
}
