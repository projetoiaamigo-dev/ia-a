const panel = document.querySelector("#field-connection");
const statusNode = document.querySelector("#field-oauth-status");
const redirectNode = document.querySelector("#field-oauth-redirect");
const listNode = document.querySelector("#field-oauth-list");

const YOUTUBE_READONLY = "https://www.googleapis.com/auth/youtube.readonly";
const CLIENT_ID_KEY = "iaa.google.oauth.client_id";
const DEFAULT_CLIENT_ID = "686007116621-9ubhrl0hc03bgku5k5ii3orlibet892c.apps.googleusercontent.com";
const CONNECTIONS_KEY = "iaa.google.youtube.connections.v1";

const slots = [
  { slot: "fale-com-deus", expectedName: "Fale com Deus" },
  { slot: "web-radio-louvar", expectedName: "Web Rádio Louvar" }
];

let activeToken = null;
let activeSlot = null;
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

function saveClientId(value) {
  const clean = String(value || "").trim();
  if (!/^[0-9A-Za-z_-]+\.apps\.googleusercontent\.com$/.test(clean)) {
    throw new Error("Client ID inválido. Ele deve terminar em .apps.googleusercontent.com");
  }
  localStorage.setItem(CLIENT_ID_KEY, clean);
}

async function fetchMyChannel(accessToken) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,id");
  url.searchParams.set("mine", "true");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Não foi possível ler o canal do YouTube.";
    throw new Error(message);
  }
  const channel = data?.items?.[0];
  if (!channel) throw new Error("A conta autorizada não retornou um canal do YouTube.");
  return { id: channel.id, title: channel.snippet?.title || "Canal sem título" };
}

function ensureTokenClient(slot) {
  const clientId = getClientId();
  if (!clientId) throw new Error("Client ID do Google não configurado.");
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services ainda não carregou. Atualize a página.");

  activeSlot = slot;
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
        const channel = await fetchMyChannel(activeToken);
        const connections = loadConnections();
        connections[activeSlot] = {
          connected: true,
          confirmed: false,
          actualChannel: channel,
          readOnly: true,
          connectedAt: new Date().toISOString()
        };
        saveConnections(connections);
        setMessage("Google/YouTube respondeu. Confirme abaixo se o canal identificado é o correto.", "success");
        render();
      } catch (error) {
        setMessage(error.message, "error");
      }
    }
  });
}

function connect(slot) {
  try {
    ensureTokenClient(slot);
    tokenClient.requestAccessToken({ prompt: "consent" });
  } catch (error) {
    setMessage(error.message, "error");
    render();
  }
}

function confirmSlot(slot) {
  const connections = loadConnections();
  if (!connections[slot]?.connected) return;
  connections[slot].confirmed = true;
  saveConnections(connections);
  setMessage(`${slots.find((x) => x.slot === slot)?.expectedName || "Canal"} confirmado manualmente.`, "success");
  render();
}

function disconnectSlot(slot) {
  const connections = loadConnections();
  delete connections[slot];
  saveConnections(connections);
  if (activeToken && window.google?.accounts?.oauth2?.revoke) {
    google.accounts.oauth2.revoke(activeToken, () => {});
  }
  activeToken = null;
  setMessage("Conexão removida deste navegador.", "success");
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

function renderConnection(def, connections) {
  const connection = connections[def.slot] || null;
  const card = document.createElement("article");
  card.className = "oauth-channel-card";
  const title = document.createElement("h3");
  title.textContent = def.expectedName;
  const copy = document.createElement("p");
  copy.textContent = connection?.connected
    ? `Canal identificado: ${connection.actualChannel?.title || "desconhecido"}`
    : "Ainda não conectado.";
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
  } else if (!connection.confirmed) {
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "secondary";
    confirm.textContent = "Confirmar que é o canal correto";
    confirm.addEventListener("click", () => confirmSlot(def.slot));
    card.append(confirm);
  } else {
    const ok = document.createElement("p");
    ok.className = "oauth-confirmed";
    ok.textContent = "Identidade confirmada manualmente.";
    card.append(ok);
  }

  if (connection?.connected) {
    const disconnect = document.createElement("button");
    disconnect.type = "button";
    disconnect.className = "secondary";
    disconnect.textContent = "Desconectar deste navegador";
    disconnect.addEventListener("click", () => disconnectSlot(def.slot));
    card.append(disconnect);
  }
  return card;
}

function render() {
  const connections = loadConnections();
  redirectNode.textContent = `Chrome HTTPS: ${location.origin} · origem autorizada no Google.`;
  const nodes = [renderClientIdSetup(), ...slots.map((slot) => renderConnection(slot, connections))];
  listNode.replaceChildren(...nodes);
  if (!statusNode.textContent) {
    setMessage("Modo Chrome pronto para autorização Google/YouTube em somente leitura.", "success");
  }
}

if (panel) render();
