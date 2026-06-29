/**
 * theme.js — KV (Key-Value) por modality com cores ENS
 */

const MODALITY_COLORS = {
  institucional: { primary: '#009DB7', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#F5F8F9', primarySoft: '#E0F2F5' },
  mba: { primary: '#005563', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#F2F4F5', primarySoft: '#DDE7EA' },
  graduacao: { primary: '#F57222', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#FEF6F1', primarySoft: '#FDE2D0' },
  chcs: { primary: '#009688', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#F1F8F7', primarySoft: '#D2EBE8' },
  cursos: { primary: '#FFA000', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#FEF9EE', primarySoft: '#FCE8C2' },
  imersao_internacional: { primary: '#BD7904', paper: '#FFFFFF', ink: '#1A1A1A', inkSoft: '#4A4A4A', surface: '#FAF4E8', primarySoft: '#F0DDB2' },
  china_immersao: { primary: '#FF0000', paper: '#000000', ink: '#FFFFFF', inkSoft: '#D0D0D0', surface: '#1A0000', primarySoft: '#330000' },
};

function buildTheme(kv = {}) {
  const modality = kv.modality || 'institucional';
  const baseColors = MODALITY_COLORS[modality] || MODALITY_COLORS.institucional;
  const theme = {
    ...baseColors,
    modality,
    format: kv.format || 'slide',
    title: kv.title || 'Apresentação',
    author: kv.author || 'ENS',
    subject: kv.subject || '',
  };
  if (kv.primary) theme.primary = kv.primary;
  if (kv.paper) theme.paper = kv.paper;
  if (kv.ink) theme.ink = kv.ink;

  return {
    ...theme,
    toCssVars() {
      return `:root {
  --primary: ${theme.primary};
  --primary-soft: ${theme.primarySoft};
  --ink: ${theme.ink};
  --ink-soft: ${theme.inkSoft};
  --paper: ${theme.paper};
  --surface: ${theme.surface};
}`;
    },
    toDataModality() {
      return theme.modality;
    },
  };
}

module.exports = { buildTheme, MODALITY_COLORS };
