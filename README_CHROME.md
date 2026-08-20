# IA A — Chrome independente

Aplicação web estática para uso no Chrome em Android.

Não exige backend próprio, funções serverless, variáveis de ambiente de hospedagem, Client Secret no navegador ou callback OAuth de servidor.

A autenticação Google/YouTube usa o fluxo OAuth para aplicação JavaScript no navegador, com escopo inicial somente de leitura do YouTube (`https://www.googleapis.com/auth/youtube.readonly`).

Para a conexão Google/YouTube funcionar, a aplicação deve ser servida por uma origem HTTPS autorizada no cliente OAuth do Google. O provedor de hospedagem pode ser qualquer serviço compatível com site estático HTTPS.

Status oficial do núcleo: 99%, pendente validação real em campo.
