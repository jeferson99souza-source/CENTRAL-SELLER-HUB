/** Chave do tema no localStorage. */
export const CHAVE_TEMA = 'csh-tema'

/**
 * Script que roda ANTES da primeira pintura da tela.
 *
 * Sem ele a página aparece branca por um instante e só depois fica escura —
 * aquele "flash" que incomoda justamente de noite, quando o modo noturno é
 * mais usado. Por isso é um script inline no <head>, e não um efeito do React:
 * efeito só roda depois da tela já ter sido desenhada.
 *
 * Fica num arquivo sem 'use client' para poder ser importado pelo layout,
 * que é componente de servidor.
 */
export const SCRIPT_TEMA = `
(function(){
  try {
    var t = localStorage.getItem('${CHAVE_TEMA}');
    var escuro = t === 'escuro' ||
      (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (escuro) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`
