# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/78f4098e-c2aa-43b9-96ba-83ac7bb596df

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/78f4098e-c2aa-43b9-96ba-83ac7bb596df) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### 🚀 Despliegue en Vercel (La opción más sencilla)

**Ver la guía completa en [DEPLOY.md](./DEPLOY.md)**

**Resumen rápido:**
1. Sube tu código a GitHub
2. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
3. Haz clic en "Add New Project" y selecciona tu repositorio
4. Agrega las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_NEXTMV_API_KEY`
5. Haz clic en "Deploy"
6. ¡Listo! 🎉

**Nota**: Vercel detectará automáticamente que es un proyecto Vite y lo configurará correctamente.

### Otras opciones

- **Lovable**: Simply open [Lovable](https://lovable.dev/projects/78f4098e-c2aa-43b9-96ba-83ac7bb596df) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
