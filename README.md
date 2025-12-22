# Welcome to your Lovable project

> **Deployment Status**: This project is configured for GitHub Pages deployment. Last updated for deployment testing.

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

### Deploy to GitHub Pages

This project is configured to automatically deploy to GitHub Pages using GitHub Actions.

**Initial Setup:**

1. **Enable GitHub Pages in your repository:**
   - Go to your repository on GitHub
   - Click on **Settings** → **Pages**
   - Under "Source", select **GitHub Actions** (not "Deploy from a branch")
   - Save the settings

2. **Push your code to GitHub:**
   ```sh
   git add .
   git commit -m "Add GitHub Pages deployment"
   git push origin main
   ```

3. **Wait for deployment:**
   - Go to the **Actions** tab in your repository
   - The workflow will automatically run and deploy your site
   - Once complete, your site will be available at:
     `https://<your-username>.github.io/<repository-name>/`

**Automatic Deployments:**
- Every push to the `main` branch will automatically trigger a new deployment
- You can also manually trigger deployments from the Actions tab

**Note:** If your repository name is different from `what-is-nextmv`, the GitHub Actions workflow will automatically use the correct repository name for the base path.

### Deploy via Lovable

Alternatively, you can deploy using Lovable:
Simply open [Lovable](https://lovable.dev/projects/78f4098e-c2aa-43b9-96ba-83ac7bb596df) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
