// TEST: Telegram-бот (удалить после проверки)
(function initTelegramTest() {
    const TG_BOT_USERNAME = "Kuratorjurnalbot";
    const btn = document.getElementById("tgTestBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
        window.open(`https://t.me/${TG_BOT_USERNAME}`, "_blank", "noopener,noreferrer");
    });
})();
