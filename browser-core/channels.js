export const PILOT_CHANNELS = Object.freeze([
  Object.freeze({
    id: "web-radio-louvar",
    name: "Web Rádio Louvar",
    monetization: "never"
  }),
  Object.freeze({
    id: "fale-com-deus",
    name: "Fale com Deus",
    monetization: "enabled"
  })
]);

export function findPilotChannel(channelId) {
  return PILOT_CHANNELS.find((channel) => channel.id === channelId) ?? null;
}
