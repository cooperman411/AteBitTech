(function(){
  const themeButton = document.getElementById("theme-toggle");
  const deviceButton = document.getElementById("theme-device");
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function current(){ return document.documentElement.dataset.theme || (media.matches ? "dark" : "light"); }
  function update(){ themeButton.textContent = current() === "dark" ? "☀" : "☾"; themeButton.setAttribute("aria-label", `Switch to ${current() === "dark" ? "light" : "dark"} theme`); }
  themeButton.addEventListener("click", () => { const next = current() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("atebit-theme", next); } catch (_) {} update(); });
  deviceButton.addEventListener("click", () => { delete document.documentElement.dataset.theme; try { localStorage.removeItem("atebit-theme"); } catch (_) {} update(); });
  media.addEventListener("change", update); update();
  const hc = document.getElementById("hc-toggle"); hc.addEventListener("click", () => { document.documentElement.classList.toggle("hc"); hc.setAttribute("aria-pressed", String(document.documentElement.classList.contains("hc"))); });
})();
