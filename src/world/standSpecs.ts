import type { StandOptions } from './standTexture';

// The two software stands: one source for the board in the 3D world and for the enlarged scheme
// shown in the side panel when the car stops there.
export const ALBION_STAND: StandOptions = {
  era: 'ПРОЕКТ 02 // АВТОМАТИЗАЦИЯ',
  title: 'ALBION BOT',
  subtitle: 'Ассистент координатора: WhatsApp · Telegram · MeritHub',
  metrics: ['MERITHUB|интеграция по API', 'WHATSAPP · TELEGRAM|уведомления', 'AI|заявки и сценарии'],
  accentHex: '#38bdf8',
  secondaryHex: '#f59e0b',
  diagram: 'albion',
};

export const TENDERS_STAND: StandOptions = {
  era: 'ПРОЕКТ 03 // ТЕНДЕРЫ И АНАЛИТИКА',
  title: 'ТЕНДЕРНАЯ АНАЛИТИКА',
  subtitle: 'Платформа анализа госзакупок Беларуси',
  metrics: ['API GIAS.BY|данные о торгах', 'КОНКУРЕНТЫ|анализ участия', 'ПЛАНЫ ЗАКУПОК|анализ и фильтр'],
  accentHex: '#f59e0b',
  secondaryHex: '#38bdf8',
  diagram: 'tenders',
};

export const STAND_BY_PROJECT: Record<string, StandOptions | undefined> = {
  albion: ALBION_STAND,
  tenders: TENDERS_STAND,
};