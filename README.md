# Atlan MDLH Entity Dictionary

An interactive reference guide for Atlan Metadata Lakehouse (MDLH) entity types, tables, and attributes. Built with React, Vite, and Tailwind CSS.

## 🌐 Live Demo

Once deployed, your site will be available at:
```
https://<your-username>.github.io/mdlh-entity-dictionary/
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Deploying to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

1. **Create a new GitHub repository** named `mdlh-entity-dictionary`

2. **Push this code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/mdlh-entity-dictionary.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Build and deployment", select **GitHub Actions** as the source
   - The workflow will automatically run on push to `main`

4. **Wait for deployment:**
   - Check the **Actions** tab to monitor the deployment
   - Once complete, your site will be live!

### Option 2: Manual Deployment with gh-pages

```bash
# Build and deploy
npm run build
npm run deploy
```

Note: For manual deployment, you may need to configure the repository URL in `package.json`.

## ⚙️ Configuration

### Changing the Repository Name

If your repository has a different name than `mdlh-entity-dictionary`, update the `base` path in `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',
})
```

### Deploying to Root Domain

If deploying to a custom domain or the root of your user pages (`username.github.io`), change the base to:

```js
base: '/',
```

## 📋 Features

- **11 Category Tabs**: Core, Glossary, Data Mesh, Relational DB, Query Org, BI Tools, dbt, Object Storage, Orchestration, Governance, AI/ML
- **Search Functionality**: Filter entities across all columns
- **CSV Export**: Export individual tabs or all data
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Easy on the eyes for technical documentation

## 🛠️ Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [Lucide React Icons](https://lucide.dev/)

## 📁 Project Structure

```
mdlh-entity-dictionary/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions workflow
├── public/
│   └── favicon.svg         # Site favicon
├── src/
│   ├── App.jsx             # Main React component
│   ├── main.jsx            # React entry point
│   └── index.css           # Tailwind CSS imports
├── index.html              # HTML template
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── postcss.config.js       # PostCSS configuration
```

## 📝 License

MIT

