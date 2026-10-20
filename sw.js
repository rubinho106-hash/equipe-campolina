// Service worker minimo do Apontador -- so pra habilitar "Instalar app" no
// Android/Chrome. De proposito NAO faz cache offline nenhum (decisao
// tomada com o Rubens: comecar so instalavel, evoluir pra offline depois
// se fizer falta) -- so precisa existir e responder ao install/activate
// pra o navegador considerar o site instalavel.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// fetch precisa existir (mesmo vazio) em alguns navegadores pra passar no
// criterio de instalabilidade -- sem isso, deixa a rede seguir normal.
self.addEventListener("fetch", () => {});
