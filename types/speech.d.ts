// types/speech.d.ts
// Web Speech API（SpeechRecognition）の最小アンビエント型定義。
// 標準 lib.dom には SpeechRecognition / SpeechRecognitionEvent /
// SpeechRecognitionErrorEvent が未収録のため、利用箇所
// （app/kids/[kidId]/quiz/QuizClient.tsx・components/GuideChatModal.tsx）向けに補う。
// ※ SpeechRecognitionResult / ResultList / Alternative は lib.dom に既存のため再宣言しない。

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
