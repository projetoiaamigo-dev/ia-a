# IA A — Chrome independente

Aplicação web estática oficial do projeto **IA A** para uso no Chrome em Android.

## Arquitetura do YouTube

A IA A possui **cinco canais distintos no YouTube**. Cada canal tem sua própria conexão OAuth, identidade, ID e link:

1. Web Rádio Louvar — em atividade;
2. Fale com Deus — em atividade;
3. Eu Oro por Você — canal existente, em configuração e preparação para monetização;
4. Código da Bíblia — canal existente, em configuração e preparação para monetização;
5. Palavra que Desperta — canal existente, em configuração e preparação para monetização.

Uma conexão não é compartilhada entre canais. O sistema impede a confirmação do mesmo ID/link do YouTube em dois canais diferentes.

Cada canal possui cérebro próprio. Dados, padrões e aprendizados não são transferidos automaticamente de um canal para outro.

Os cérebros oficiais são preservados e alimentados com dados reais de campo; não são reconstruídos.

## Segurança

Não exige backend próprio, funções serverless, variáveis de ambiente de hospedagem, Client Secret no navegador ou callback OAuth de servidor.

A autenticação Google/YouTube usa o fluxo OAuth para aplicação JavaScript no navegador, com escopo inicial somente de leitura do YouTube (`https://www.googleapis.com/auth/youtube.readonly`).

A aplicação deve ser servida por uma origem HTTPS autorizada no cliente OAuth do Google.

Status oficial do núcleo: 99%, pendente validação real em campo.
