// Preencha com a configuração de um NOVO projeto Firebase da Campolina.
window.CAMPOLINA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvOhCDA-gN-7u8GsN_6pjMH_HNsa27z9Y",
  authDomain: "equipe-campolina.firebaseapp.com",
  projectId: "equipe-campolina",
  storageBucket: "equipe-campolina.firebasestorage.app",
  messagingSenderId: "278100830500",
  appId: "1:278100830500:web:4f4196133e3d69bb656bb1"
};

function validarConfiguracaoCampolina(config) {
  const campos = ["apiKey", "authDomain", "projectId", "appId"];
  const incompleta = !config || campos.some(campo => !config[campo]?.trim());
  const original = config && Object.values(config).some(valor => /concretta/i.test(String(valor)));
  if (!incompleta && !original) return;
  const mostrar = () => {
    const aviso = document.createElement("div");
    aviso.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0b1330;color:white;display:grid;place-content:center;padding:32px;font:18px/1.6 system-ui";
    const titulo = document.createElement("h1");
    titulo.textContent = "Equipe Campolina";
    const texto = document.createElement("p");
    texto.textContent = "Configuração pendente: conecte um projeto Firebase exclusivo da Campolina em campolina-config.js para começar.";
    aviso.append(titulo, texto);
    document.body.replaceChildren(aviso);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrar, { once: true });
  else mostrar();
  throw new Error("Campolina: configure um Firebase independente antes de usar o sistema.");
}
