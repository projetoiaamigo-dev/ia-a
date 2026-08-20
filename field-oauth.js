const panel = document.querySelector("#field-connection");
const statusNode = document.querySelector("#field-oauth-status");
const redirectNode = document.querySelector("#field-oauth-redirect");
const listNode = document.querySelector("#field-oauth-list");

const YOUTUBE_READONLY = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_CLIENT_ID = "686007116621-9ubhrl0hc03bgku5k5ii3orlibet892c.apps.googleusercontent.com";
const OFFICIAL_CONNECTION_KEY = "iaa.google.youtube.official-connection.v2";
const LEGACY_CONNECTIONS_KEY = "iaa.google.youtube.connections.v1";
const PROJECT_NAME = "PROJETO IA A";
const OFFICIAL_CHANNEL_NAME = "PROJETO IA";
const PROJECT_CHANNELS = Object.freeze([
  Object.freeze({ id: "web-radio-louvar", name: "Web Rádio Louvar", status: "active", logo: "./icons/channels/web-radio-louvar.webp" }),
  Object.freeze({ id: "fale-com-deus", name: "Fale com Deus", status: "active", logo: "./icons/channels/fale-com-deus.webp" }),
  Object.freeze({ id: "codigo-da-biblia", name: "Código da Bíblia", status: "configuration_pending", logo: "./icons/channels/codigo-da-biblia.webp" }),
  Object.freeze({ id: "eu-oro-por-voce", name: "Eu Oro por Você", status: "configuration_pending", logo: "./icons/channels/eu-oro-por-voce.webp" }),
  Object.freeze({ id: "palavra-que-desperta", name: "Palavra que Desperta", status: "configuration_pending", logo: "./icons/channels/palavra-que-desperta.webp" })
]);

let activeToken = null;
let tokenClient = null;

function setMessage(text, kind = "") {
  statusNode.textContent = text;
  statusNode.dataset.kind = kind;
}

function readStoredJson(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveConnection(value) {
  if (!value) {
    localStorage.removeItem(OFFICIAL_CONNECTION_KEY);
    return;
  }
  localStorage.setItem(OFFICIAL_CONNECTION_KEY, JSON.stringify(value));
}

function getClientId() {
  return DEFAULT_CLIENT_ID;
}

function normalizeChannel(value) {
  if (!value?.id) return null;
  return {
    id: String(value.id),
    title: String(value.title || "Canal sem título")
  };
}

function getAvailableChannels(connection) {
  const source = Array.isArray(connection?.availableChannels)
    ? connection.availableChannels
    : [connection?.actualChannel];
  const unique = new Map();
  source.map(normalizeChannel).filter(Boolean).forEach((channel) => unique.set(channel.id, channel));
  return [...unique.values()];
}

function getSelectedChannel(connection) {
  const channels = getAvailableChannels(connection);
  const selectedId = connection?.selectedChannelId || connection?.actualChannel?.id || "";
  return channels.find((channel) => channel.id === selectedId) || null;
}

function migrateLegacyConnection() {
  const legacy = readStoredJson(LEGACY_CONNECTIONS_KEY);
  if (!legacy) return null;
  const candidates = Object.values(legacy).filter((connection) => connection?.connected);
  const source = candidates.find((connection) => connection.confirmed && getSelectedChannel(connection))
    || candidates.find((connection) => getSelectedChannel(connection));
  if (!source) return null;
  const availableChannels = getAvailableChannels(source);
  const selectedChannel = getSelectedChannel(source);
  const migrated = {
    connected: true,
    confirmed: false,
    channelScanComplete: source.channelScanComplete === true,
    availableChannels,
    selectedChannelId: selectedChannel?.id || "",
    actualChannel: selectedChannel,
    readOnly: true,
    migratedFromLegacy: true,
    connectedAt: source.connectedAt || new Date().toISOString(),
    migratedAt: new Date().toISOString()
  };
  saveConnection(migrated);
  return migrated;
}

function loadConnection() {
  return readStoredJson(OFFICIAL_CONNECTION_KEY) || migrateLegacyConnection();
}

async function fetchMyChannels(accessToken) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,id");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Não foi possível ler o canal oficial do YouTube.";
    throw new Error(message);
  }
  const unique = new Map();
  (data?.items || [])
    .map((channel) => normalizeChannel({ id: channel.id, title: channel.snippet?.title }))
    .filter(Boolean)
    .forEach((channel) => unique.set(channel.id, channel));
  const channels = [...unique.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (!channels.length) throw new Error("A conta autorizada não retornou um canal do YouTube.");
  return channels;
}

function ensureTokenClient() {
  const clientId = getClientId();
  if (!clientId) throw new Error("Client ID do Google não configurado.");
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services ainda não carregou. Atualize a página.");

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: YOUTUBE_READONLY,
    callback: async (response) => {
      if (response?.error) {
        setMessage(`Google não concluiu a autorização: ${response.error}`, "error");
        return;
      }
      try {
        activeToken = response.access_token || null;
        const channels = await fetchMyChannels(activeToken);
        const selectedChannel = channels.length === 1 ? channels[0] : null;
        saveConnection({
          connected: true,
          confirmed: false,
          channelScanComplete: true,
          availableChannels: channels,
          selectedChannelId: selectedChannel?.id || "",
          actualChannel: selectedChannel,
          readOnly: true,
          migratedFromLegacy: false,
          connectedAt: new Date().toISOString()
        });
        const count = channels.length;
        setMessage(
          `${count} ${count === 1 ? "canal encontrado" : "canais encontrados"}. Confirme abaixo o canal oficial do ${PROJECT_NAME}.`,
          "success"
        );
        render();
      } catch (error) {
        setMessage(error.message, "error");
      }
    },
    error_callback: (error) => {
      const message = error?.type === "popup_closed"
        ? "A janela do Google foi fechada antes da escolha do canal."
        : "Não foi possível abrir a autorização do Google.";
      setMessage(message, "error");
    }
  });
}

function connect() {
  try {
    ensureTokenClient();
    tokenClient.requestAccessToken({ prompt: "select_account consent" });
  } catch (error) {
    setMessage(error.message, "error");
    render();
  }
}

function selectChannel(channelId) {
  const connection = loadConnection();
  if (!connection?.connected) return;
  const channel = getAvailableChannels(connection).find((item) => item.id === channelId) || null;
  connection.selectedChannelId = channel?.id || "";
  connection.actualChannel = channel;
  connection.confirmed = false;
  saveConnection(connection);
  setMessage(channel ? `Canal oficial selecionado: ${channel.title}.` : "Escolha o canal oficial para continuar.", channel ? "success" : "");
  render();
}

function confirmOfficialChannel() {
  const connection = loadConnection();
  const selectedChannel = getSelectedChannel(connection);
  if (!connection?.connected || !selectedChannel) {
    setMessage("Escolha o canal oficial antes de confirmar.", "error");
    return;
  }
  connection.selectedChannelId = selectedChannel.id;
  connection.actualChannel = selectedChannel;
  connection.confirmed = true;
  saveConnection(connection);
  setMessage(`Canal oficial ${selectedChannel.title} confirmado para o ${PROJECT_NAME}.`, "success");
  render();
}

function disconnect() {
  saveConnection(null);
  localStorage.removeItem(LEGACY_CONNECTIONS_KEY);
  activeToken = null;
  setMessage("Associação oficial removida deste navegador.", "success");
  render();
}

function renderClientIdSetup() {
  const wrap = document.createElement("div");
  wrap.className = "oauth-channel-card";
  const title = document.createElement("h3");
  title.textContent = "Configuração do Chrome";
  const copy = document.createElement("p");
  copy.textContent = "Client ID público do Google já configurado. Client Secret não é usado.";
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "text";
  input.autocomplete = "off";
  input.value = getClientId();
  input.readOnly = true;
  input.setAttribute("aria-label", "Google OAuth Client ID");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = "Client ID configurado";
  button.disabled = true;
  wrap.append(title, copy, input, button);
  return wrap;
}

function renderOfficialConnection(connection) {
  const selectedChannel = getSelectedChannel(connection);
  const card = document.createElement("article");
  card.className = "oauth-channel-card";
  const title = document.createElement("h3");
  title.textContent = "Canal oficial do YouTube";
  const copy = document.createElement("p");
  if (!connection?.connected) {
    copy.textContent = `Ainda não conectado. Canal esperado: ${OFFICIAL_CHANNEL_NAME}.`;
  } else if (connection.confirmed && selectedChannel) {
    copy.textContent = `Canal oficial confirmado: ${selectedChannel.title}`;
  } else if (selectedChannel) {
    copy.textContent = `Canal oficial identificado: ${selectedChannel.title}`;
  } else {
    copy.textContent = "Conta conectada. Escolha o canal oficial abaixo.";
  }
  const safety = document.createElement("p");
  safety.className = "oauth-safety";
  safety.textContent = "Uma única conexão atende todos os canais internos. Somente leitura; publicação desativada.";
  card.append(title, copy, safety);

  if (!connection?.connected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Conectar canal oficial";
    button.disabled = !getClientId();
    button.addEventListener("click", connect);
    card.append(button);
    return card;
  }

  if (connection.migratedFromLegacy) {
    const migrated = document.createElement("p");
    migrated.className = "oauth-safety";
    migrated.textContent = "A conexão anterior foi preservada e convertida para uma única conexão oficial.";
    card.append(migrated);
  }

  const channels = getAvailableChannels(connection);
  if (connection.channelScanComplete && channels.length > 1) {
    const label = document.createElement("label");
    label.textContent = `Canal oficial do ${PROJECT_NAME}`;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Canal oficial do ${PROJECT_NAME}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Escolha o canal oficial";
    select.append(placeholder);
    channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = channel.title;
      select.append(option);
    });
    select.value = selectedChannel?.id || "";
    select.addEventListener("change", () => selectChannel(select.value));
    label.append(select);
    card.append(label);
  }

  if (!connection.confirmed) {
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "secondary";
    confirm.textContent = "Confirmar canal oficial";
    confirm.disabled = !selectedChannel;
    confirm.addEventListener("click", confirmOfficialChannel);
    card.append(confirm);
  } else {
    const ok = document.createElement("p");
    ok.className = "oauth-confirmed";
    ok.textContent = `Conexão oficial compartilhada pelos canais do ${PROJECT_NAME}.`;
    card.append(ok);
  }

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "secondary";
  refresh.textContent = "Buscar canal novamente";
  refresh.addEventListener("click", connect);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Remover associação local";
  remove.addEventListener("click", disconnect);
  card.append(refresh, remove);
  return card;
}

function renderProjectChannels() {
  const card = document.createElement("article");
  card.className = "oauth-channel-card";
  const title = document.createElement("h3");
  title.textContent = `Canais do ${PROJECT_NAME}`;
  const copy = document.createElement("p");
  copy.textContent = `Todos usam o mesmo canal oficial do YouTube: ${OFFICIAL_CHANNEL_NAME}.`;
  const list = document.createElement("ul");
  list.className = "oauth-project-channel-list";
  PROJECT_CHANNELS.forEach((channel) => {
    const item = document.createElement("li");
    item.className = "oauth-project-channel-item";
    const logo = document.createElement("img");
    logo.src = channel.logo;
    logo.alt = `Identidade de ${channel.name}`;
    logo.width = 72;
    logo.height = 72;
    logo.loading = "lazy";
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = channel.name;
    const status = document.createElement("small");
    status.textContent = channel.status === "active" ? "Em atividade" : "Em configuração";
    text.append(name, status);
    item.append(logo, text);
    list.append(item);
  });
  card.append(title, copy, list);
  return card;
}

function render() {
  const connection = loadConnection();
  redirectNode.textContent = `Chrome HTTPS: ${location.origin} · origem autorizada no Google.`;
  listNode.replaceChildren(
    renderClientIdSetup(),
    renderOfficialConnection(connection),
    renderProjectChannels()
  );
  if (!statusNode.textContent) {
    setMessage(`Uma conexão Google/YouTube atende todos os canais do ${PROJECT_NAME}.`, "success");
  }
}

if (panel) render();
