# Deutsch Turbo — Configurações

Fonte única de preferências de **interface**: `UiPrefsService` (`localStorage` chave `dt_uiprefs`).

Preferências **pedagógicas** no `UserProfile` (IndexedDB via StorageService): `turboMode`, `germanPercentage`, `speechSpeed`, `dailyMinutes`.

## Tabela

| Configuração | Onde salva | Quem lê | Efeito real |
|---|---|---|---|
| Tema | `ThemeService` (`dt_theme`) | `main.tsx` | Aplica `.light` / dark no HTML |
| Tradução | `UiPrefs.translationMode` | Conversa Gemini / Lesson | Sempre / sob demanda / imersão |
| Nível de ajuda | `UiPrefs.helpLevel` | `useLesson` + Gemini (`helpLevel`) | Ajuda inicial + instrução ao professor |
| Velocidade da voz | `profile.speechSpeed` | `VoiceService` / lição mock | Velocidade TTS (não Live PCM) |
| Tempo/dia | `profile.dailyMinutes` | `planTodaysTraining` | Duração do plano |
| Modo intensivo | `profile.turboMode` | `TeacherEngine` + Gemini | Mais speaking; orientação intensiva ao coach |
| Sons (UI) | `UiPrefs.sound` | `SoundService` | Beeps de start/end/tap — **não** silencia Gemini |
| Vibração | `UiPrefs.haptics` | `HapticService` / `haptic()` | `navigator.vibrate` se existir |
| Notificações | `UiPrefs.notifications` + permission | `NotificationService` | Lembretes locais com app aberto |
| Idioma da UI | `UiPrefs.interfaceLanguage` | `LocaleService` / `t()` | Labels Settings + nav (+ chaves) |
| Imersão | `UiPrefs.immersionTarget` + `profile.germanPercentage` | Gemini `immersionLevel` + guidance | % de alemão do professor |

## Limitações do navegador

- **Vibração**: só com `navigator.vibrate` (mobile). Desktop: preferência salva, sem efeito.
- **Notificações**: pedem permissão explícita. Lembretes locais funcionam com o PWA **aberto**. Push em background no Android exige Service Worker + servidor push — **não implementado**.
- **Sons**: OscillatorNode; alguns browsers exigem gesto do usuário antes do áudio.
- **Idioma**: Settings + BottomNav + chaves principais. Telas legadas ainda podem ter strings em PT hardcoded (expandir via `t()`).
- **Velocidade da voz** no Gemini Live: o stream PCM não usa `speechSpeed` do perfil; a opção vale para o motor TTS local/mock.

## Privacidade

- Áudio do microfone é enviado em tempo real ao Gemini Live; **não** é gravado em disco pelo app.
- `GEMINI_API_KEY` fica só no servidor (`server/.env`).

## Reset

“Restaurar configurações” chama `UiPrefsService.reset()` e zera `turboMode`/imersão no perfil. **Não** apaga memória, sessões, curso nem IndexedDB de aprendizado.

## Testes

```bash
npx tsx scripts/test-settings.ts
```
