const CHANNEL_CATALOG = Object.freeze([
  Object.freeze({
    id: "web-radio-louvar",
    name: "Web Rádio Louvar",
    status: "active",
    monetization: "never",
    logo: "./icons/channels/web-radio-louvar.webp"
  }),
  Object.freeze({
    id: "fale-com-deus",
    name: "Fale com Deus",
    status: "active",
    monetization: "enabled",
    logo: "./icons/channels/fale-com-deus.webp"
  }),
  Object.freeze({
    id: "eu-oro-por-voce",
    name: "Eu Oro por Você",
    status: "configuration_pending",
    monetization: "pending",
    logo: "./icons/channels/eu-oro-por-voce.webp"
  }),
  Object.freeze({
    id: "codigo-da-biblia",
    name: "Código da Bíblia",
    status: "configuration_pending",
    monetization: "pending",
    logo: "./icons/channels/codigo-da-biblia.webp"
  }),
  Object.freeze({
    id: "palavra-que-desperta",
    name: "Palavra que Desperta",
    status: "configuration_pending",
    monetization: "pending",
    logo: "./icons/channels/palavra-que-desperta.webp"
  })
]);

export const PROJECT_CHANNELS = CHANNEL_CATALOG;

export const PILOT_CHANNELS = Object.freeze(
  CHANNEL_CATALOG.filter((channel) => channel.status === "active")
);

export const CONFIGURATION_PENDING_CHANNELS = Object.freeze(
  CHANNEL_CATALOG.filter((channel) => channel.status === "configuration_pending")
);

// Alias preservado para versões anteriores do núcleo.
export const PLANNED_CHANNELS = CONFIGURATION_PENDING_CHANNELS;

export function findPilotChannel(channelId) {
  return PILOT_CHANNELS.find((channel) => channel.id === channelId) ?? null;
}

export function findProjectChannel(channelId) {
  return PROJECT_CHANNELS.find((channel) => channel.id === channelId) ?? null;
}
