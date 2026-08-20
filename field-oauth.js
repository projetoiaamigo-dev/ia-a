const panel = document.querySelector("#field-connection");
const statusNode = document.querySelector("#field-oauth-status");
const redirectNode = document.querySelector("#field-oauth-redirect");
const listNode = document.querySelector("#field-oauth-list");

const YOUTUBE_READONLY = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_CLIENT_ID = "686007116621-9ubhrl0hc03bgku5k5ii3orlibet892c.apps.googleusercontent.com";
const CONNECTIONS_KEY = "iaa.google.youtube.connections.v1";

const slots = [
  { slot: "fale-com-deus", expectedName: "Fale com Deus" },
  { slot: "web-radio-louvar", expectedName: "Web Rádio Louvar" }
];

let activeToken = null;
let tokenClient = null;

function setMessage(text, kind = "") {
  statusNode.textContent = text;
  statusNode.dataset.kind = kind;
}

function loadConnections() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONNECTIONS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveConnections(value) {
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(value));
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

function getUsedChannelIds(connections, currentSlot) {
  return new Set(
    Object.entries(connections)
      .filter(([slot]) => slot !== currentSlot)
      .map(([, connection]) => getSelectedChannel(connection)?.id)
      .filter(Boolean)
  );
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
    const message = data?.error?.message || "Não foi possível ler os canais do YouTube.";
    throw new Error(message);
  }
  const unique = new Map();
  (data?.items || [])
    .map((channel) => normalizeChannel({
      id: channel.id,
      title: channel.snippet?.title
    }))
    .filter(Boolean)
    .forEach((channel) => unique.set(channel.id, channel));
  const channels = [...unique.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (!channels.length) throw new Error("A conta autorizada não retornou canais do YouTube.");
  return channels;
}

function ensureTokenClient(slot) {
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
        const connections = loadConnections();
        const selectedChannel = channels.length === 1 ? channels[0] : null;
        connections[slot] = {
          connected: true,
          confirmed: false,
          channelScanComplete: true,
          availableChannels: channels,
          selectedChannelId: selectedChannel?.id || "",
          actualChannel: selectedChannel,
          readOnly: true,
          connectedAt: new Date().toISOString()
        };
        saveConnections(connections);
        const count = channels.length;
        setMessage(
          `${count} ${count === 1 ? "canal encontrado" : "canais encontrados"}. Escolha abaixo qual pertence a este espaço.`,
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

function connect(slot) {
  try {
    ensureTokenClient(slot);
    tokenClient.requestAccessToken({ prompt: "select_account consent" });
  } catch (error) {
    setMessage(error.message, "error");
    render();
  }
}

function selectChannel(slot, channelId) {
  const connections = loadConnections();
  const connection = connections[slot];
  if (!connection?.connected) return;
  const channel = getAvailableChannels(connection).find((item) => item.id === channelId) || null;
  const usedIds = getUsedChannelIds(connections, slot);
  if (channel && usedIds.has(channel.id)) {
    setMessage("Este canal já está associado a outro espaço. Escolha um canal diferente.", "error");
    return;
  }
  connection.selectedChannelId = channel?.id || "";
  connection.actualChannel = channel;
  connection.confirmed = false;
  saveConnections(connections);
  setMessage(channel ? `Canal selecionado: ${channel.title}.` : "Escolha um canal para continuar.", channel ? "success" : "");
  render();
}

function confirmSlot(slot) {
  const connections = loadConnections();
  const connection = connections[slot];
  const selectedChannel = getSelectedChannel(connection);
  if (!connection?.connected || !selectedChannel) {
    setMessage("Escolha um canal antes de confirmar.", "error");
    return;
  }
  if (getUsedChannelIds(connections, slot).has(selectedChannel.id)) {
    setMessage("Este canal já está associado a outro espaço. Escolha um canal diferente.", "error");
    return;
  }
  connection.selectedChannelId = selectedChannel.id;
  connection.actualChannel = selectedChannel;
  connection.confirmed = true;
  saveConnections(connections);
  setMessage(`${slots.find((item) => item.slot === slot)?.expectedName || "Canal"} associado a ${selectedChannel.title}.`, "success");
  render();
}

function disconnectSlot(slot) {
  const connections = loadConnections();
  delete connections[slot];
  saveConnections(connections);
  activeToken = null;
  setMessage("Associação removida deste navegador.", "success");
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

function renderChannelPicker(def, connection, connections, card) {
  const channels = getAvailableChannels(connection);
  const selectedChannel = getSelectedChannel(connection);
  const usedIds = getUsedChannelIds(connections, def.slot);

  if (!connection.channelScanComplete) {
    const legacy = document.createElement("p");
    legacy.className = "oauth-safety";
    legacy.textContent = "Conexão anterior detectada. Busque os canais novamente para separar corretamente esta conta.";
    card.append(legacy);
    return;
  }

  const summary = document.createElement("p");
  summary.className = "oauth-safety";
  summary.textContent = channels.length === 1
    ? "1 canal disponível. Se esperava outro, busque novamente e escolha outro perfil no Google."
    : `${channels.length} canais disponíveis nesta autorização. Escolha o canal deste espaço.`;
  card.append(summary);

  if (channels.length > 1) {
    const label = document.createElement("label");
    label.textContent = `Canal do YouTube para ${def.expectedName}`;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Canal do YouTube para ${def.expectedName}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Escolha o canal correto";
    select.append(placeholder);
    channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = usedIds.has(channel.id) ? `${channel.title} — já associado` : channel.title;
      option.disabled = usedIds.has(channel.id);
      select.append(option);
    });
    select.value = selectedChannel?.id || "";
    select.addEventListener("change", () => selectChannel(def.slot, select.value));
    label.append(select);
    card.append(label);
  }
}

function renderConnection(def, connections) {
  const connection = connections[def.slot] || null;
  const selectedChannel = getSelectedChannel(connection);
  const card = document.createElement("article");
  card.className = "oauth-channel-card";
  const title = document.createElement("h3");
  title.textContent = def.expectedName;
  const copy = document.createElement("p");
  if (!connection?.connected) {
    copy.textContent = "Ainda não conectado.";
  } else if (connection.confirmed && selectedChannel) {
    copy.textContent = `Canal confirmado: ${selectedChannel.title}`;
  } else if (selectedChannel) {
    copy.textContent = `Canal selecionado: ${selectedChannel.title}`;
  } else {
    copy.textContent = "Conta conectada. Escolha o canal correto abaixo.";
  }
  const safety = document.createElement("p");
  safety.className = "oauth-safety";
  safety.textContent = "Somente leitura (youtube.readonly). Publicação desativada.";
  card.append(title, copy, safety);

  if (!connection?.connected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = `Conectar ${def.expectedName}`;
    button.disabled = !getClientId();
    button.addEventListener("click", () => connect(def.slot));
    card.append(button);
    return card;
  }

  renderChannelPicker(def, connection, connections, card);

  if (connection.channelScanComplete && !connection.confirmed) {
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "secondary";
    confirm.textContent = "Confirmar canal deste espaço";
    confirm.disabled = !selectedChannel || getUsedChannelIds(connections, def.slot).has(selectedChannel.id);
    confirm.addEventListener("click", () => confirmSlot(def.slot));
    card.append(confirm);
  } else if (connection.confirmed) {
    const ok = document.createElement("p");
    ok.className = "oauth-confirmed";
    ok.textContent = "Canal associado sem duplicação.";
    card.append(ok);
  }

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "secondary";
  refresh.textContent = connection.channelScanComplete ? "Buscar canais novamente" : "Buscar canais da conta";
  refresh.addEventListener("click", () => connect(def.slot));
  const disconnect = document.createElement("button");
  disconnect.type = "button";
  disconnect.className = "secondary";
  disconnect.textContent = "Remover associação local";
  disconnect.addEventListener("click", () => disconnectSlot(def.slot));
  card.append(refresh, disconnect);
  return card;
}

function render() {
  const connections = loadConnections();
  redirectNode.textContent = `Chrome HTTPS: ${location.origin} · origem autorizada no Google.`;
  const nodes = [renderClientIdSetup(), ...slots.map((slot) => renderConnection(slot, connections))];
  listNode.replaceChildren(...nodes);
  if (!statusNode.textContent) {
    setMessage("Modo Chrome pronto para listar e separar canais do Google/YouTube em somente leitura.", "success");
  }
}

if (panel) render();
