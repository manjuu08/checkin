// ==UserScript==
// @name          LMS 正誤/選択問題一括入力
// @namespace     http://tampermonkey.net/
// @version       1.0
// @description   Tampermonkeyメニューからポップアップを開き、「正/誤」や「A/B/C/D」といった解答リストを一括貼り付けすることで、Blackboardの正誤問題・選択問題へ自動的にチェックを入れます。選択した解答の全解除や、レビューページからの解答抽出・コピー機能も備えています。
// @match         https://lms2017.teikyo-u.ac.jp/*
// @grant         GM_registerMenuCommand
// @grant         GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Webポップアップ補助関数 ----------

  function webAlert(msg) {
    const existing = document.getElementById('bb-tf-alert-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bb-tf-alert-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.5)',
      zIndex: 10000000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#fff',
      padding: '24px',
      borderRadius: '8px',
      width: '400px',
      maxWidth: '90vw',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      lineHeight: '1.6',
    });

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'margin-bottom:16px;white-space:pre-wrap;word-break:break-all;';
    msgDiv.textContent = msg;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'text-align:right;';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    Object.assign(okBtn.style, {
      padding: '6px 20px',
      background: '#0d6efd',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    });
    okBtn.onclick = () => overlay.remove();

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    btnRow.appendChild(okBtn);
    box.appendChild(msgDiv);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function webConfirm(msg) {
    return new Promise((resolve) => {
      const existing = document.getElementById('bb-tf-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'bb-tf-confirm-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 10000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      });

      const box = document.createElement('div');
      Object.assign(box.style, {
        background: '#fff',
        padding: '24px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        lineHeight: '1.6',
      });

      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = 'margin-bottom:16px;white-space:pre-wrap;word-break:break-all;';
      msgDiv.textContent = msg;

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'text-align:right;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      Object.assign(cancelBtn.style, {
        marginRight: '8px',
        padding: '6px 14px',
        cursor: 'pointer',
        border: '1px solid #ccc',
        borderRadius: '4px',
        background: '#fff',
      });
      cancelBtn.onclick = () => { overlay.remove(); resolve(false); };

      const okBtn = document.createElement('button');
      okBtn.textContent = '確認';
      Object.assign(okBtn.style, {
        padding: '6px 14px',
        background: '#0d6efd',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      });
      okBtn.onclick = () => { overlay.remove(); resolve(true); };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(false); }
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      box.appendChild(msgDiv);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  // ---------- 解答の記入 ----------

  function showDialog() {
    const existing = document.getElementById('bb-tf-filler-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bb-tf-filler-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#fff',
      padding: '20px',
      borderRadius: '8px',
      width: '360px',
      maxWidth: '90vw',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif',
    });

    const title = document.createElement('div');
    title.textContent = '解答を貼り付けてください（1行につき1つ、「正/誤」または「A/B/C/D」、問題順）';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;font-size:14px;';

    const textarea = document.createElement('textarea');
    Object.assign(textarea.style, {
      width: '100%',
      height: '220px',
      boxSizing: 'border-box',
      fontSize: '14px',
      padding: '6px',
      resize: 'vertical',
    });
    textarea.placeholder = '正\n正\nA\n誤\nC\nB\n正\nD\n誤\nA';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top:12px;text-align:right;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'キャンセル';
    Object.assign(cancelBtn.style, {
      marginRight: '8px',
      padding: '6px 14px',
      cursor: 'pointer',
      border: '1px solid #ccc',
      borderRadius: '4px',
      background: '#fff',
    });
    cancelBtn.onclick = () => overlay.remove();

    const okBtn = document.createElement('button');
    okBtn.textContent = '記入を確定';
    Object.assign(okBtn.style, {
      padding: '6px 14px',
      background: '#0d6efd',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    });
    okBtn.onclick = async () => {
      const lines = textarea.value
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      await fillAnswers(lines);
      overlay.remove();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(title);
    box.appendChild(textarea);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    textarea.focus();
  }

  async function fillAnswers(lines) {
    const allQuestions = document.querySelectorAll('.assessment-question');
    const questions = Array.from(allQuestions).filter(q =>
      q.classList.contains('js-question-type-eitherOr') ||
      q.querySelector('input[type="radio"], input[type="checkbox"]')
    );

    if (questions.length === 0) {
      webAlert('問題が見つかりません。ページが完全に読み込まれていることを確認してから再度お試しください。');
      return;
    }

    if (lines.length !== questions.length) {
      const proceed = await webConfirm(
        `${lines.length} 行の解答が入力されましたが、ページ上には ${questions.length} 問あります。\nこのまま順番通りに記入しますか？（余分な行は無視され、足りない問題は記入されません）`
      );
      if (!proceed) return;
    }

    let filled = 0;
    const skipped = [];

    questions.forEach((q, i) => {
      const ans = lines[i];
      if (!ans) {
        skipped.push(i + 1);
        return;
      }

      const isTF = q.classList.contains('js-question-type-eitherOr');

      if (isTF) {
        let selector;
        if (ans === '正') {
          selector = 'input[data-analytics-id="assessments.canvas.question.option.true"]';
        } else if (ans === '誤' || ans === '误') {
          selector = 'input[data-analytics-id="assessments.canvas.question.option.false"]';
        } else {
          skipped.push(i + 1);
          return;
        }

        const input = q.querySelector(selector);
        if (input) {
          input.click();
          filled++;
        } else {
          skipped.push(i + 1);
        }
      } else {
        const letterIndex = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
        const idx = letterIndex[ans];
        if (idx === undefined) {
          skipped.push(i + 1);
          return;
        }

        const inputs = q.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        let target = null;

        // 1) オプション A / 選択肢 A / A. / A) のラベルテキストで照合
        const labelPatterns = [
          new RegExp(`オプション\\s*${ans}`, 'i'),
          new RegExp(`選択肢\\s*${ans}`, 'i'),
          new RegExp(`^\\s*${ans}\\s*[.)}:]`),
        ];
        for (const input of inputs) {
          const container = input.closest('.answer-option, .option-row, .option, .form-check') || input.parentElement;
          const text = container ? container.textContent : '';
          if (labelPatterns.some(p => p.test(text))) {
            target = input;
            break;
          }
        }

        // 2) フォールバック：DOM順（A→1番目, B→2番目…）
        if (!target && inputs[idx]) {
          target = inputs[idx];
        }

        if (target) {
          target.click();
          filled++;
        } else {
          skipped.push(i + 1);
        }
      }
    });

    let msg = `${filled} 問の記入に成功しました。`;
    if (skipped.length) {
      msg += `\n以下の問題番号は認識できなかったか、記入されませんでした：第 ${skipped.join('、')} 問`;
    }
    webAlert(msg);
  }

  // ---------- すべての解答をクリア ----------

  function clearAllAnswers() {
    // 1) data-analytics-id で厳密一致
    let buttons = document.querySelectorAll(
      'button[data-analytics-id="assessments.canvas.question.clear.selection"]'
    );

    // 2) 部分一致（clear.selection を含むもの）
    if (buttons.length === 0) {
      buttons = document.querySelectorAll('[data-analytics-id*="clear"i]');
    }

    // 3) テキストに「クリア」を含むボタン／リンク
    if (buttons.length === 0) {
      const candidates = document.querySelectorAll('button, a, [role="button"]');
      buttons = Array.from(candidates).filter(el =>
        el.textContent.includes('クリア') || el.textContent.includes('選択をクリア')
      );
    }

    // 4) それでも見つからなければ全 questions 内の選択済み input を直接クリア
    if (buttons.length === 0) {
      const questions = document.querySelectorAll('.assessment-question');
      let clicked = 0;
      questions.forEach(q => {
        const checked = q.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
        checked.forEach(input => { input.click(); clicked++; });
      });
      if (clicked > 0) {
        webAlert(`${clicked} 個の選択済み解答をクリックして解除しました。`);
      } else {
        webAlert('選択済みの解答が見つかりませんでした。');
      }
      return;
    }

    buttons.forEach(btn => btn.click());
    webAlert(`${buttons.length} 個の「選択をクリア」をクリックし、解答をクリアしました。`);
  }

  // ---------- クリップボード補助 ----------

  function copyToClipboard(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ---------- ページから正解テキストを抽出 ----------

  function extractAnswers() {
    const container = document.querySelector('[ng-if*="attemptCanvas.hasQuestions"]');
    if (!container) {
      webAlert('問題コンテナが見つかりません。');
      return;
    }

    const text = container.textContent.trim();
    if (!text) {
      webAlert('コンテナ内にテキストがありません。');
      return;
    }

    copyToClipboard(text);
    webAlert('問題と解答をクリップボードにコピーしました。');
  }

  // ---------- Tampermonkeyメニューの登録 ----------

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('正誤/選択問題の一括記入', showDialog);
    GM_registerMenuCommand('選択済みの解答を一括クリア', clearAllAnswers);
    GM_registerMenuCommand('問題と解答を抽出してコピー', extractAnswers);
  }
})();
