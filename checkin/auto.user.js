// ==UserScript==
// @name         衛生報告入力自動化ツール
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  衛生報告入力の自動化ツール。確認者IDの自動抽出・選択機能に加え、体温自動入力や個人ID設定により、日々の報告業務を効率化します。
// @author       manjuu08
// @match        https://app.hisol-work.net/*
// @icon  　　　　https://free-icons.net/wp-content/uploads/2020/10/symbol033.png
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @homepage    https://github.com/manjuu08/checkin
// @supportURL  https://github.com/manjuu08/checkin/issues
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';

    // --- ID 管理配置（出勤者IDのみ） ---
    GM_registerMenuCommand("⚙️ 出勤者IDを設定", () => {
        showIdInputPopup(GM_getValue('target_user_id', ''), (id) => {
            GM_setValue('target_user_id', id);
            if (id === '') {
                alert("出勤者IDを削除しました");
            }
        });
    });
    GM_registerMenuCommand("🗑️ 全ての設定を削除", () => {
        GM_setValue('target_user_id', '');
        alert("設定を削除しました");
    });

    // --- 主逻辑 ---
    setInterval(() => {
        const btnContainer = document.querySelector('input[placeholder="出勤者名選択"]')?.parentElement?.parentElement;
        if (btnContainer && !document.getElementById('inject-all-btn')) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative; margin-top:10px; background:#5EA500; border-radius:4px;';
            const btn = document.createElement('button');
            btn.id = 'inject-all-btn';
            btn.innerText = '✅ 一括全自動入力';
            btn.style.cssText = 'padding:10px 16px; background:transparent; color:white; border:none; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;';
            const credit = document.createElement('span');
            credit.innerText = 'by ショウ';
            credit.style.cssText = 'position:absolute; bottom:3px; right:6px; font-size:10px; color:rgba(255,255,255,0.7);';
            wrapper.appendChild(btn);
            wrapper.appendChild(credit);
            btn.onclick = async () => {
                // 1. 勾选
                document.querySelectorAll('img').forEach(img => {
                    if (img.src && img.src.includes('%235EA500')) {
                        (img.closest('button') || img.parentElement)?.click();
                    }
                });
                // 2. 随机体温
                const temp = (36.0 + Math.random() * 0.5).toFixed(1);
                const tempInput = document.querySelector('input.w-full.h-full.pr-7.text-center.font-bold.rounded-md.border.border-gray-200');
                if (tempInput) {
                    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(tempInput, temp);
                    tempInput.dispatchEvent(new Event('input', { bubbles: true }));
                    tempInput.dispatchEvent(new Event('change', { bubbles: true }));
                    tempInput.dispatchEvent(new Event('blur', { bubbles: true }));
                }
                // 3. 出勤者IDを自動選択
                await selectID("出勤者名選択", GM_getValue('target_user_id', ''));

                // 4. 確認者は自動スキャン→ポップアップで手動選択
                autoScanAndShowPopup();
            };
            btnContainer.appendChild(wrapper);
        }
    }, 1000);

    async function selectID(placeholder, id) {
        if (!id) return;
        const input = document.querySelector(`input[placeholder="${placeholder}"]`);
        if (!input) return;
        input.click();
        await new Promise(r => setTimeout(r, 600));

        const options = document.querySelectorAll('li[role="option"]');
        for (let li of options) {
            if (li.textContent.includes(id)) {
                li.click();
                break;
            }
        }
    }

    // --- 設定用：ページ内入力ポップアップ（ブラウザのprompt()の代替） ---
    function showIdInputPopup(currentValue, onConfirm) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10001; display:flex; justify-content:center; align-items:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:white; padding:20px; border-radius:8px; min-width:300px;';
        box.innerHTML = `
            <h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:10px;">出勤者IDを設定</h3>
            <p style="font-size:13px; color:#666; margin:4px 0 10px;">空欄で保存すると削除扱いになります</p>
            <input id="id-input-field" type="text" style="width:100%; box-sizing:border-box; padding:8px; font-size:14px; border:1px solid #ccc; border-radius:4px;" />
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button id="id-input-cancel" style="flex:1; padding:10px; cursor:pointer; background:#f0f0f0; border:1px solid #ddd; border-radius:4px;">キャンセル</button>
                <button id="id-input-save" style="flex:1; padding:10px; cursor:pointer; background:#5EA500; color:white; border:none; border-radius:4px; font-weight:bold;">保存</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const field = box.querySelector('#id-input-field');
        field.value = currentValue;
        field.focus();

        const close = () => document.body.removeChild(overlay);

        box.querySelector('#id-input-cancel').onclick = close;

        const save = () => {
            const id = field.value.trim();
            close();
            onConfirm(id);
        };
        box.querySelector('#id-input-save').onclick = save;

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    // --- 確認者：自動スキャンロジック（033始まりのIDを抽出） ---
    function autoScanAndShowPopup() {
        const approverInput = document.querySelector('input[placeholder="確認者名選択"]');
        if (!approverInput) return;

        approverInput.click();

        setTimeout(() => {
            const foundUsers = [];
            document.querySelectorAll('li[role="option"]').forEach(li => {
                const text = li.textContent.trim();

                // ✅ 033で始まるIDのみを厳密にマッチ（前に他の数字が連なっていないこと）
                const match = text.match(/(?<!\d)033\d+/);

                if (match) {
                    const id = match[0];
                    foundUsers.push({ name: text.replace(id, "").trim(), id: id });
                }
            });

            if (foundUsers.length > 0) {
                showApproverPopup(foundUsers);
            } else {
                alert("033から始まる社員IDが見つかりませんでした（読み込み待ちの可能性あり）。ドロップダウンが展開されているか確認してください。");
            }
        }, 800);
    }

    // --- 確認者：動的ポップアップ表示ロジック ---
    function showApproverPopup(users) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; justify-content:center; align-items:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:white; padding:20px; border-radius:8px; min-width:300px; max-height:80vh; overflow-y:auto;';
        box.innerHTML = '<h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:10px;">確認者を選択してください:</h3>';

        users.forEach(p => {
            const nBtn = document.createElement('button');
            nBtn.innerHTML = `<strong>${p.name}</strong> <span style="color:#666;">(ID: ${p.id})</span>`;
            nBtn.style.cssText = 'display:block; width:100%; margin:8px 0; padding:10px; cursor:pointer; background:#f9f9f9; border:1px solid #ddd; border-radius:4px; text-align:left;';
            nBtn.onclick = () => {
                selectApproverById(p.id);
                document.body.removeChild(overlay);
            };
            box.appendChild(nBtn);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // --- 確認者：指定IDを選択 ---
    function selectApproverById(targetId) {
        const approverInput = document.querySelector('input[placeholder="確認者名選択"]');
        if (approverInput) {
            approverInput.click();
            setTimeout(() => {
                document.querySelectorAll('li[role="option"]').forEach(li => {
                    if (li.textContent.includes(targetId)) {
                        li.click();
                    }
                });
            }, 500);
        }
    }
})();
