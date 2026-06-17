<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

## 🚀 Como Corrigir a Página em Branco no GitHub Pages

Se o seu site está aparecendo em branco ou com erro de MIME type (`application/octet-stream`), siga estes passos:

1. Acesse as **Configurações (Settings)** do seu repositório no GitHub.
2. Clique em **Pages** no menu lateral.
3. Em **Build and deployment > Source**, você tem duas opções:
   - **Opção A (Recomendada):** Mude para **GitHub Actions**. Isso automatiza todo o processo de publicação.
   - **Opção B (Manual):** Mantenha "Deploy from a branch", escolha a branch `main` e mude a pasta de `/ (root)` para **/docs**.
4. Clique em **Save**.
5. Aguarde 2-3 minutos e recarregue a página com `Ctrl + F5`.

---

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/aa0c8988-6c81-437f-accb-9dc4378bb3cd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
