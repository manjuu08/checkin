// ==UserScript==
// @name         衛生報告入力自動化ツール
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  衛生報告入力の効率化ツール。確認者ID(0330始まり)の自動取得と選択機能を提供します。
// @author       You
// @match        https://app.hisol-work.net/*
// @grant        none
// @license MIT
// @homepage    https://github.com/manjuu08/checkin
// @supportURL  https://github.com/manjuu08/checkin/issues
// ==/UserScript==

(function() {
    'use strict';

    // ボタン挿入（重複防止）
    const observer = new MutationObserver(() => {
        const targetContainer = document.querySelector('input[placeholder="出勤者名選択"]')?.parentElement?.parentElement;

        if (targetContainer && !document.getElementById('inject-all-btn')) {
            const btn = document.createElement('button');
            btn.id = 'inject-all-btn';
            btn.innerText = '✅ 一括全自動入力';
            btn.style.cssText = `
                margin-top:10px;
                padding:10px 16px;
                background:#5EA500;
                color:white;
                border:none;
                border-radius:4px;
                cursor:pointer;
                width:100%;
                font-weight:bold;
            `;

            btn.onclick = () => {
                // 1. チェックボックスを一括選択
                document.querySelectorAll('img').forEach(img => {
                    if (img.src && img.src.includes('%235EA500')) {
                        const clickable = img.closest('button') || img.parentElement;
                        if (clickable) clickable.click();
                    }
                });

                // 2. 体温を自動入力
                const tempInput = document.querySelector('input.w-full.h-full.pr-7.text-center.font-bold.rounded-md.border.border-gray-200');
                if (tempInput) {
                    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
                    setter.call(tempInput, "36.3");
                    tempInput.dispatchEvent(new Event('input', { bubbles: true }));
                    tempInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // 3. 確認者をスキャン
                autoScanAndShowPopup();
            };

            targetContainer.appendChild(btn);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // =========================
    // 自動スキャン処理（0330対応）
    // =========================
    function autoScanAndShowPopup() {
        const approverInput = document.querySelector('input[placeholder="確認者名選択"]');
        if (!approverInput) return;

        approverInput.click();

        setTimeout(() => {
            const foundUsers = [];

            document.querySelectorAll('li[role="option"]').forEach(li => {
                const text = li.textContent.trim();

                // 0330で始まる社員IDのみ抽出
                const match = text.match(/0330\d+/);

                if (match) {
                    const id = match[0];

                    foundUsers.push({
                        name: text.replace(id, "").trim(),
                        id: id
                    });
                }
            });

            if (foundUsers.length > 0) {
                showApproverPopup(foundUsers);
            } else {
                alert("0330から始まる社員IDが見つかりませんでした（読み込み待ちの可能性あり）");
            }
        }, 800);
    }

    // =========================
    // ポップアップ表示
    // =========================
    function showApproverPopup(users) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;
            top:0; left:0;
            width:100%; height:100%;
            background:rgba(0,0,0,0.5);
            z-index:10000;
            display:flex;
            justify-content:center;
            align-items:center;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background:white;
            padding:20px;
            border-radius:8px;
            min-width:300px;
            max-height:80vh;
            overflow-y:auto;
        `;

        box.innerHTML = `<h3 style="margin-top:0;">確認者を選択してください:</h3>`;

        users.forEach(p => {
            const btn = document.createElement('button');
            btn.innerHTML = `<strong>${p.name}</strong> <span style="color:#666;">(ID: ${p.id})</span>`;
            btn.style.cssText = `
                display:block;
                width:100%;
                margin:8px 0;
                padding:10px;
                cursor:pointer;
                background:#f9f9f9;
                border:1px solid #ddd;
                border-radius:4px;
                text-align:left;
            `;

            btn.onclick = () => {
                selectApproverById(p.id);
                document.body.removeChild(overlay);
            };

            box.appendChild(btn);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // =========================
    // ID選択処理
    // =========================
    function selectApproverById(targetId) {
        const approverInput = document.querySelector('input[placeholder="確認者名選択"]');
        if (!approverInput) return;

        approverInput.click();

        setTimeout(() => {
            document.querySelectorAll('li[role="option"]').forEach(li => {
                if (li.textContent.includes(targetId)) {
                    li.click();
                }
            });
        }, 500);
    }

})();
