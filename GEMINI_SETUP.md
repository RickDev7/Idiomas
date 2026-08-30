# 🇩🇪 DEUTSCH TURBO — Integração Gemini Live

Conversa por voz real com **Gemini 3.1 Flash Live Preview** via backend seguro.

## Arquitetura

```
Frontend (PWA)
   ↓ POST /api/gemini/token   (emite token efêmero)
   ↓ WS   /api/gemini/live     (ponte de áudio bidirecional)
Backend (server/)
   ↓ @google/genai  ai.live.connect()
Gemini Live API
```

- A `GEMINI_API_KEY` fica **somente no backend** (variável de ambiente).
- O frontend nunca recebe a chave — recebe um token efêmero (5 min) que autoriza o WebSocket.
- O backend mantém a sessão Live do Gemini por cliente e faz a ponte de áudio.



## Configuração



### 1. Obter a API key do Gemini

1. Acesse [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Crie uma chave de API do Google AI.
3. Salve a chave.



### 2. Configurar o backend

```bash
cd server
cp .env.example .env
# Edite .env e cole sua chave:
#   GEMINI_API_KEY=sua_chave_aqui
npm install
```



### 3. Configurar o frontend

Na raiz do projeto:

```bash
cp .env.example .env
# Edite .env:
#   VITE_USE_GEMINI_LIVE=true
#   VITE_BACKEND_URL=http://localhost:8787
```



### 4. Iniciar

Terminal 1 — backend:

```bash
cd server
npm start
```

Terminal 2 — frontend:

```bash
npm run dev
```

Abra o PWA, toque em **COMEÇAR TREINO** e converse por voz.

## Modos


| `VITE_USE_GEMINI_LIVE` | Comportamento                                        |
| ---------------------- | ---------------------------------------------------- |
| `false` (padrão)       | Usa MockAI + Web Speech API (offline)                |
| `true`                 | Usa Gemini Live via backend (requer backend rodando) |


O MockAI é **preservado** — se o backend não responder, o app não quebra; basta definir `VITE_USE_GEMINI_LIVE=false`.

## Arquivos principais

- `server/index.js` — backend Express + WebSocket + @google/genai
- `src/services/ai/GeminiLiveService.ts` — cliente WebSocket do Live
- `src/services/voice/GeminiVoiceService.ts` — captura mic + playback PCM
- `src/hooks/useGeminiLive.ts` — estado da sessão na UI
- `src/pages/GeminiConversation.tsx` — tela de voz real



## Modelo

- Live (voz): `gemini-3.1-flash-live-preview` (configurável via `GEMINI_MODEL`)
- Texto: `gemini-2.5-flash` (configurável via `GEMINI_TEXT_MODEL`)



## Privacidade

- Áudio não é salvo permanentemente.
- Apenas transcrições alimentam o Learning Engine (local).
- A chave nunca vai para o bundle, Git, localStorage ou IndexedDB.



## Solução de problemas


| Sintoma                               | Causa provável                                               |
| ------------------------------------- | ------------------------------------------------------------ |
| "Não consegui conectar ao professor." | Backend offline ou `GEMINI_API_KEY` ausente                  |
| "Preciso de acesso ao microfone."     | Permissão negada no navegador                                |
| Reconexão repetida                    | Internet instável ou token expirado                          |
| Voz não sai                           | Verifique se o backend tem a chave e o modelo `live-preview` |




## Variáveis de ambiente



### `server/.env`

```
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.1-flash-live-preview
GEMINI_TEXT_MODEL=gemini-2.5-flash
PORT=8787
```



### `.env` (raiz, frontend)

```
VITE_USE_GEMINI_LIVE=false
VITE_BACKEND_URL=http://localhost:8787
```

