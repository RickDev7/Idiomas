import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConversationContext, ConversationMessage, AIResponse } from '@/types';
import { createConversationMessage } from '@/services/ai/MockAIService';
import { getConfiguredAIService } from '@/services/ai/AIService';
import { getVoiceService } from '@/services/voice/VoiceService';
import { stopAllAudio } from '@/services/voice/AudioPlayback';
import { StorageService } from '@/services/storage/StorageService';
import { generateId } from '@/utils/reviewUtils';

interface UseConversationOptions {
  context: ConversationContext;
  autoSpeak?: boolean;
}

export function useConversation({ context, autoSpeak = true }: UseConversationOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [conversationId] = useState(() => generateId());
  const ai = useRef(getConfiguredAIService());
  const voice = useRef(getVoiceService());
  const started = useRef(false);

  const speak = useCallback(async (text: string) => {
    if (!text) return;
    stopAllAudio();
    setIsSpeaking(true);
    try {
      voice.current.setSpeed(context.userProfile.speechSpeed);
      await voice.current.speak(text);
    } catch {
      // TTS may fail silently on some devices
    } finally {
      setIsSpeaking(false);
    }
  }, [context.userProfile.speechSpeed]);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setSessionStarted(true);
    setIsProcessing(true);

    try {
      const response = await ai.current.startConversation(context);
      setCurrentResponse(response);
      const msg = createConversationMessage('assistant', response.german, {
        german: response.german,
        portuguese: response.portuguese,
        hint: response.hint,
        correction: response.correction,
      });
      addMessage(msg);
      if (autoSpeak && response.shouldSpeak) {
        await speak(response.german);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [context, autoSpeak, speak, addMessage]);

  const sendMessage = useCallback(async (
    userText: string,
    flags?: { help?: boolean; repeat?: boolean; slower?: boolean; explain?: boolean },
  ) => {
    setIsProcessing(true);

    const userMsg = createConversationMessage('user', userText);
    addMessage(userMsg);

    const updatedContext: ConversationContext = {
      ...context,
      previousMessages: [...messages, userMsg],
      helpRequested: flags?.help,
      repeatRequested: flags?.repeat,
      slowerRequested: flags?.slower,
      explainRequested: flags?.explain,
    };

    try {
      const response = await ai.current.continueConversation(updatedContext, userText);
      setCurrentResponse(response);

      const assistantMsg = createConversationMessage('assistant', response.german, {
        german: response.german,
        portuguese: response.portuguese,
        hint: response.hint,
        correction: response.correction,
      });
      addMessage(assistantMsg);

      if (response.correction && userText.trim()) {
        const { recordMistake } = await import('@/services/storage/memory');
        await recordMistake({
          userSaid: userText,
          correct: response.correction,
          explanation: response.portuguese || response.hint || 'Correção na conversa',
        });
      }

      if (autoSpeak && response.shouldSpeak) {
        if (flags?.slower) voice.current.setSpeed('slow');
        await speak(response.german);
        if (flags?.slower) voice.current.setSpeed(context.userProfile.speechSpeed);
      }

      await StorageService.saveConversation({
        id: conversationId,
        type: context.type === 'turbo' || context.type === 'quick' ? 'free' : context.type,
        title: context.topic || 'Conversa',
        messages: [...messages, userMsg, assistantMsg],
        startedAt: new Date().toISOString(),
        situationId: context.situationId,
        dayNumber: context.dayNumber,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [context, messages, autoSpeak, speak, addMessage, conversationId]);

  const startListening = useCallback(async () => {
    if (isListening || isSpeaking) return '';
    setIsListening(true);
    stopAllAudio();
    try {
      voice.current.setLanguage('de-DE');
      const transcript = await voice.current.listen();
      return transcript;
    } catch {
      return '';
    } finally {
      setIsListening(false);
    }
  }, [isListening, isSpeaking]);

  const stopListening = useCallback(() => {
    voice.current.stopListening();
    setIsListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    stopAllAudio();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    voice.current.setSpeed(context.userProfile.speechSpeed);
  }, [context.userProfile.speechSpeed]);

  return {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    currentResponse,
    sessionStarted,
    start,
    sendMessage,
    startListening,
    stopListening,
    stopSpeaking,
    speak,
    voiceSupported: voice.current.isSupported(),
  };
}
