# Atlan MDLH Entity Dictionary

An interactive reference guide for Atlan Metadata Lakehouse (MDLH) entity types, tables, and attributes. Built with React, Vite, and Tailwind CSS.

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploying to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

1. **Create a new GitHub repository** named `MDLH_Dictionary` (or your preferred name)

2. **Push this code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/MDLH_Dictionary.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to **Settings** > **Pages**
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

## Configuration

### Changing the Repository Name

If your repository has a different name, update the `base` path in `vite.config.js`:

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

## Features

- **11 Category Tabs**: Core, Glossary, Data Mesh, Relational DB, Query Org, BI Tools, dbt, Object Storage, Orchestration, Governance, AI/ML
- **Search Functionality**: Filter entities across all columns with keyboard shortcut (Cmd/Ctrl + K)
- **Example Queries**: SQL query examples for each category with copy-to-clipboard
- **CSV Export**: Export individual tabs or all data
- **Responsive Design**: Works on desktop and mobile
- **Slide-out Query Panel**: Browse and copy example queries

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Focus search input |
| `Escape` | Close query panel |

## Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [Lucide React Icons](https://lucide.dev/)
- [Vitest](https://vitest.dev/) for testing

## Project Structure

```
MDLH_Dictionary/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── public/
│   └── favicon.svg             # Site favicon
├── src/
│   ├── components/
│   │   ├── CopyButton.jsx      # Copy-to-clipboard buttons
│   │   └── QueryPanel.jsx      # Slide-out query panel
│   ├── data/
│   │   ├── entityData.js       # Entity definitions and tab config
│   │   └── exampleQueries.js   # SQL query examples
│   ├── utils/
│   │   ├── csvExport.js        # CSV generation utilities
│   │   ├── filterData.js       # Search/filter utilities
│   │   └── queryMatcher.js     # Query matching utilities
│   ├── test/
│   │   └── setup.js            # Test setup and mocks
│   ├── App.jsx                 # Main React component
│   ├── App.test.jsx            # App component tests
│   ├── main.jsx                # React entry point
│   └── index.css               # Tailwind CSS imports and custom styles
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── vitest.config.js            # Test configuration
├── tailwind.config.js          # Tailwind configuration
└── postcss.config.js           # PostCSS configuration
```

## License

MIT
