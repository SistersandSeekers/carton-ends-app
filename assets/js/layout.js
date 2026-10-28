// Builds the shared left sidebar navigation on every page.
(function () {
  const icons = {
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  };

  const links = [
    { href: "carton-counter.html", label: "Carton Counter", icon: "box" },
    { href: "create-carton-ends-from-pl.html", label: "Create labels from count", icon: "tag" },
    { href: "packing-list-creator.html", label: "Create Packing List", icon: "file" },
    { href: "index.html", label: "Create Labels", icon: "printer" },
  ];

  const current = location.pathname.split("/").pop() || "index.html";

  const nav = document.createElement("nav");
  nav.className = "sidebar no-print";
  nav.setAttribute("aria-label", "Main");
  nav.innerHTML =
    '<div class="sidebar-logo" aria-hidden="true">S&amp;S</div>' +
    links
      .map(
        (l) =>
          `<a class="sidebar-link${l.href === current ? " active" : ""}" href="${l.href}" ` +
          `data-label="${l.label}" aria-label="${l.label}"${l.href === current ? ' aria-current="page"' : ""}>` +
          `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ` +
          `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[l.icon]}</svg></a>`,
      )
      .join("");

  document.body.classList.add("has-sidebar");
  document.body.prepend(nav);
})();
