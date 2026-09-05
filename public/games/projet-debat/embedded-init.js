if (new URLSearchParams(window.location.search).get("embedded") === "1") {
  document.documentElement.dataset.embedded = "true";
}
