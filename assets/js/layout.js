// Builds the shared top navigation on every page.
(function () {
  const links = [
    { href: "carton-counter.html", label: "Carton Counter" },
    { href: "create-carton-ends-from-pl.html", label: "Create labels from count" },
    { href: "packing-list-creator.html", label: "Create Packing List" },
    { href: "index.html", label: "Create Labels" },
  ];

  const current = location.pathname.split("/").pop() || "index.html";

  const nav = document.createElement("nav");
  nav.className = "topnav no-print";
  nav.setAttribute("aria-label", "Main");
  nav.innerHTML =
    '<a class="topnav-brand" href="carton-counter.html" aria-label="Sisters and Seekers"><img src="assets/img/logo.webp" alt="Sisters and Seekers" height="22"></a>' +
    '<div class="topnav-links">' +
    links
      .map(
        (l) =>
          `<a class="topnav-link${l.href === current ? " active" : ""}" href="${l.href}"` +
          `${l.href === current ? ' aria-current="page"' : ""}>${l.label}</a>`,
      )
      .join("") +
    "</div>";

  document.body.classList.add("has-nav");
  document.body.prepend(nav);
})();
