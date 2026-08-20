const panel = document.querySelector("#field-connection");
const statusNode = document.querySelector("#field-oauth-status");
const redirectNode = document.querySelector("#field-oauth-redirect");
const listNode = document.querySelector("#field-oauth-list");

const YOUTUBE_READONLY = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_CLIENT_ID = "686007116621-9ubhrl0hc03bgku5k5ii3orlibet892c.apps.googleusercontent.com";
const CONNECTIONS_KEY = "iaa.google.youtube.channel-connections.v2";
const LEGACY_CONNECTIONS_KEY = "iaa.google.youtube.connections.v1";
const INCORRECT_SHARED_KEY = "iaa.google.youtube.official-connection.v2";
const PROJECT_NAME = "IA A";
const PROJECT_CHANNELS = Object.freeze([
  Object.freeze({ id: "web-radio-louvar", name: "Web Rádio Louvar", status: "active", logo: "./icons/channels/web-radio-louvar.webp" }),
  Object.freeze({ id: "fale-com-deus", name: "Fale com Deus", status: "active", logo: "./icons/channels/fale-com-deus.webp" }),
  Object.freeze({ id: "eu-oro-por-voce", name: "Eu Oro por Você", status: "configuration_pending", logo: "./icons/channels/eu-oro-por-voce.webp" }),
  Object.freeze({ id: "codigo-da-biblia", name: "Código da Bíblia", status: "configuration_pending", logo: "./icons/channels/codigo-da-biblia.webp" }),
  Object.freeze({ id: "palavra-que-desperta", name: "Palavra que Desperta", status: "configuration_pending", logo: "./icons/channels/palavra-que-desperta.webp" })
]);

let pendingProjectChannelId = null;
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

function saveConnections(value) {
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(value || {}));
}

function getClientId() {
  return DEFAULT_CLIENT_ID;
}

function canonicalYouTubeUrl(channelId) {
  return channelId ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}` : "";
}

function normalizeChannel(value) {
  if (!value?.id) return null;
  const id = String(value.id);
  return {
    id,
    title: String(value.title || "Canal sem título"),
    url: canonicalYouTubeUrl(id)
  };
}

function getAvailableChannels(connection) {
  const source = Array.isArray(connection?.availableChannels)
    ? connection.availableChannels
    : [connection?.actualChannel];
  const unique = new Map();
  source
    .map(normalizeChannel)
    .filter(Boolean)
    .forEach((channel) => unique.set(channel.id, channel));
  return [...unique.values()];
}

function getSelectedChannel(connection) {
  const channels = getAvailableChannels(connection);
  const selectedId = connection?.selectedChannelId || connection?.actualChannel?.id || "";
  return channels.find((channel) => channel.id === selectedId) || null;
}

function normalizeConnection(value, migrationSource = null) {
  if (!value?.connected) return null;
  const availableChannels = getAvailableChannels(value);
  const selectedChannel = getSelectedChannel(value);
  return {
    connected: true,
    confirmed: value.confirmed === true,
    channelScanComplete: value.channelScanComplete === true,
    availableChannels,
    selectedChannelId: selectedChannel?.id || "",
    actualChannel: selectedChannel,
    readOnly: true,
    migrationSource,
    connectedAt: value.connectedAt || new Date().toISOString()
  };
}

function migrateConnections() {
  const migrated = {};
  const legacy = readStoredJson(LEGACY_CONNECTIONS_KEY);
  for (const projectChannel of PROJECT_CHANNELS) {
    const normalized = normalizeConnection(legacy?.[projectChannel.id], "legacy_distinct_connection");
    if (normalized) migrated[projectChannel.id] = normalized;
  }

  // A versão compartilhada equivocada veio da associação já feita no card
  // Fale com Deus. Ela só é usada se a conexão distinta antiga não existir.
  if (!migrated["fale-com-deus"]) {
    const shared = normalizeConnection(readStoredJson(INCORRECT_SHARED_KEY), "shared_correction_to_fale_com_deus");
    if (shared) {
      shared.confirmed = false;
      migrated["fale-com-deus"] = shared;
    }
  }
  saveConnections(migrated);
  return migrated;
}

function loadConnections() {
  return readStoredJson(CONNECTIONS_KEY) || migrateConnections();
}

function updateConnection(projectChannelId, connection) {
  const connections = loadConnections();
  if (connection) connections[projectChannelId] = connection;
  else delete connections[projectChannelId];
  saveConnections(connections);
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
    throw new Error(data?.error?.message || "Não foi possível ler o canal do YouTube.");
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
  if (!getClientId()) throw new Error("Client ID do Google não configurado.");
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services ainda não carregou. Atualize a página.");
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: getClientId(),
    scope: YOUTUBE_READONLY,
    callback: async (response) => {
      const projectChannelId = pendingProjectChannelId;
      pendingProjectChannelId = null;
      if (response?.error) {
        setMessage(`Google não concluiu a autorização: ${response.error}`, "error");
        return;
      }
      try {
        const channels = await fetchMyChannels(response.access_token || "");
        const selectedChannel = channels.length === 1 ? channels[0] : null;
        updateConnection(projectChannelId, {
          connected: true,
          confirmed: false,
          channelScanComplete: true,
          availableChannels: channels,
          selectedChannelId: selectedChannel?.id || "",
          actualChannel: selectedChannel,
          readOnly: true,
          migrationSource: null,
          connectedAt: new Date().toISOString()
        });
        const projectChannel = PROJECT_CHANNELS.find((channel) => channel.id === projectChannelId);
        setMessage(
          `${channels.length} ${channels.length === 1 ? "canal encontrado" : "canais encontrados"} para ${projectChannel?.name || "o canal"}. Confirme a identidade e o link.`,
          "success"
        );
        render();
      } catch (error) {
        setMessage(error.message, "error");
      }
    },
    error_callback: (error) => {
      pendingProjectChannelId = null;
      setMessage(
        error?.type === "popup_closed"
          ? "A janela do Google foi fechada antes da escolha do canal."
          : "Não foi possível abrir a autorização do Google.",
        "error"
      );
    }
  });
}

function connect(projectChannelId) {
  try {
    ensureTokenClient();
    pendingProjectChannelId = projectChannelId;
    tokenClient.requestAccessToken({ prompt: "select_account consent" });
  } catch (error) {
    pendingProjectChannelId = null;
    setMessage(error.message, "error");
    render();
  }
}

function selectChannel(projectChannelId, youtubeChannelId) {
  const connections = loadConnections();
  const connection = connections[projectChannelId];
  if (!connection?.connected) return;
  const selected = getAvailableChannels(connection).find((channel) => channel.id === youtubeChannelId) || null;
  connection.selectedChannelId = selected?.id || "";
  connection.actualChannel = selected;
  connection.confirmed = false;
  updateConnection(projectChannelId, connection);
  setMessage(selected ? `Canal do YouTube selecionado: ${selected.title}.` : "Escolha o canal correto.", selected ? "success" : "");
  render();
}

function confirmChannel(projectChannelId) {
  const connections = loadConnections();
  const connection = connections[projectChannelId];
  const selected = getSelectedChannel(connection);
  if (!connection?.connected || !selected) {
    setMessage("Escolha o canal do YouTube antes de confirmar.", "error");
    return;
  }
  const duplicate = Object.entries(connections).find(
    ([otherId, otherConnection]) =>
      otherId !== projectChannelId &&
      otherConnection?.confirmed &&
      getSelectedChannel(otherConnection)?.id === selected.id
  );
  if (duplicate) {
    const other = PROJECT_CHANNELS.find((channel) => channel.id === duplicate[0]);
    setMessage(
      `Esse link já está confirmado para ${other?.name || "outro canal"}. Cada canal da IA A precisa ter link diferente.`,
      "error"
    );
    return;
  }
  connection.confirmed = true;
  connection.actualChannel = selected;
  connection.selectedChannelId = selected.id;
  updateConnection(projectChannelId, connection);
  const projectChannel = PROJECT_CHANNELS.find((channel) => channel.id === projectChannelId);
  setMessage(`${projectChannel?.name}: canal e link do YouTube confirmados.`, "success");
  render();
}

function disconnect(projectChannelId) {
  updateConnection(projectChannelId, null);
  setMessage("Associação removida somente deste canal.", "success");
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

function renderChannelCard(projectChannel, connection) {
  const selected = getSelectedChannel(connection);
  const card = document.createElement("article");
  card.className = "oauth-channel-card";
  const header = document.createElement("div");
  header.className = "oauth-channel-heading";
  const logo = document.createElement("img");
  logo.src = projectChannel.logo;
  logo.alt = `Identidade de ${projectChannel.name}`;
  logo.width = 72;
  logo.height = 72;
  const headingText = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = projectChannel.name;
  const status = document.createElement("small");
  status.textContent = projectChannel.status === "active" ? "Em atividade" : "Em configuração";
  headingText.append(title, status);
  header.append(logo, headingText);

  const copy = document.createElement("p");
  if (!connection?.connected) copy.textContent = "Canal do YouTube ainda não conectado.";
  else if (connection.confirmed && selected) copy.textContent = `Canal confirmado: ${selected.title}`;
  else if (selected) copy.textContent = `Canal identificado: ${selected.title}`;
  else copy.textContent = "Conta conectada. Escolha abaixo o canal correto.";
  const safety = document.createElement("p");
  safety.className = "oauth-safety";
  safety.textContent = "Conexão e link exclusivos deste canal. Somente leitura; publicação desativada.";
  card.append(header, copy, safety);

  if (!connection?.connected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = `Conectar ${projectChannel.name}`;
    button.disabled = !getClientId();
    button.addEventListener("click", () => connect(projectChannel.id));
    card.append(button);
    return card;
  }

  if (connection.migrationSource) {
    const migrated = document.createElement("p");
    migrated.className = "oauth-safety";
    migrated.textContent = "A conexão anterior foi preservada. Confirme se este é o canal e o link corretos.";
    card.append(migrated);
  }

  const channels = getAvailableChannels(connection);
  if (connection.channelScanComplete && channels.length > 1) {
    const label = document.createElement("label");
    label.textContent = `Canal do YouTube para ${projectChannel.name}`;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Canal do YouTube para ${projectChannel.name}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Escolha o canal correto";
    select.append(placeholder);
    channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = channel.title;
      select.append(option);
    });
    select.value = selected?.id || "";
    select.addEventListener("change", () => selectChannel(projectChannel.id, select.value));
    label.append(select);
    card.append(label);
  }

  if (selected) {
    const link = document.createElement("a");
    link.className = "oauth-youtube-link";
    link.href = selected.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = selected.url;
    card.append(link);
  }

  if (!connection.confirmed) {
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "secondary";
    confirm.textContent = `Confirmar ${projectChannel.name}`;
    confirm.disabled = !selected;
    confirm.addEventListener("click", () => confirmChannel(projectChannel.id));
    card.append(confirm);
  } else {
    const ok = document.createElement("p");
    ok.className = "oauth-confirmed";
    ok.textContent = "Canal e link confirmados.";
    card.append(ok);
  }

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "secondary";
  refresh.textContent = "Buscar novamente";
  refresh.addEventListener("click", () => connect(projectChannel.id));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Remover associação";
  remove.addEventListener("click", () => disconnect(projectChannel.id));
  card.append(refresh, remove);
  return card;
}

function render() {
  const connections = loadConnections();
  redirectNode.textContent = `Chrome HTTPS: ${location.origin} · origem autorizada no Google.`;
  listNode.replaceChildren(
    renderClientIdSetup(),
    ...PROJECT_CHANNELS.map((channel) => renderChannelCard(channel, connections[channel.id]))
  );
  if (!statusNode.textContent) {
    setMessage(`${PROJECT_NAME}: cinco canais do YouTube separados, cada um com seu próprio link.`, "success");
  }
}

if (panel) render();
