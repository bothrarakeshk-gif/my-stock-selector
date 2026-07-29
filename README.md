# Product Selector App

A full-stack Azure app — React frontend + C# Azure Functions backend — that lets users select products from a list, save the selection under a codename to Azure Blob Storage, and restore it on next visit.

---

## Project Structure

```
product-selector-app/
├── src/
│   ├── main.jsx              # React entry point
│   └── ProductSelector.jsx   # Main app component
├── public/
│   └── favicon.svg
├── api/                      # Azure Functions (C# .NET 6)
│   ├── SaveSelection.cs      # POST /api/selections
│   ├── GetSelection.cs       # GET  /api/selections/{codename}
│   ├── ProductSelector.Functions.csproj
│   └── local.settings.json   # Local dev settings (not committed)
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml   # CI/CD pipeline
├── index.html
├── vite.config.js
├── package.json
├── staticwebapp.config.json  # SWA routing rules
└── README.md
```

---

## Local Development

### Prerequisites
- Node.js 18+
- .NET 6 SDK
- Azure Functions Core Tools v4: `npm i -g azure-functions-core-tools@4`
- Azurite (local blob emulator): `npm i -g azurite`

### Run locally

**Terminal 1 — Start Azurite (blob emulator)**
```bash
azurite
```

**Terminal 2 — Start Azure Functions**
```bash
cd api
func start
# Functions available at http://localhost:7071/api
```

**Terminal 3 — Start React dev server**
```bash
npm install
npm run dev
# App available at http://localhost:5173
# /api/* is proxied to localhost:7071 via vite.config.js
```

---

## Deploy to Azure

### 1. Create infrastructure

```bash
# Create resource group
az group create -n rg-product-selector -l eastus

# Create storage account
az storage account create \
  --name stproductselector \
  --resource-group rg-product-selector \
  --sku Standard_LRS

# Create blob container
az storage container create \
  --name product-selections \
  --account-name stproductselector

# Get connection string (save this for step 3)
az storage account show-connection-string \
  --name stproductselector \
  --resource-group rg-product-selector \
  --query connectionString -o tsv
```

### 2. Create Static Web App

```bash
az staticwebapp create \
  --name product-selector-app \
  --resource-group rg-product-selector \
  --source https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO> \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist"
```

Or create via **Azure Portal** → Static Web Apps → Create → connect your GitHub repo.

### 3. Add environment variables

In **Azure Portal** → your Static Web App → **Configuration** → add:

| Name | Value |
|------|-------|
| `AzureWebJobsStorage` | `<connection string from step 1>` |
| `BlobContainerName` | `product-selections` |

### 4. Add GitHub secret for CI/CD

In **Azure Portal** → Static Web App → **Manage deployment token** → copy the token.

In **GitHub** → your repo → Settings → Secrets and Variables → Actions → New secret:
- Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Value: paste the token

### 5. Push and deploy

```bash
git add .
git commit -m "deploy"
git push origin main
```

GitHub Actions builds and deploys automatically (~2 min). Your app will be live at:
`https://<random-name>.azurestaticapps.net`

---

## API Reference

### POST `/api/selections`
Save a product selection.

**Request body:**
```json
{
  "codename": "my-config",
  "selectedProducts": ["prod-001", "prod-004", "prod-011"]
}
```

**Response 200:**
```json
{
  "success": true,
  "codename": "my-config",
  "savedAt": "2026-07-29T10:00:00Z"
}
```

---

### GET `/api/selections/{codename}`
Load a saved selection.

**Response 200:**
```json
{
  "codename": "my-config",
  "selectedProducts": ["prod-001", "prod-004", "prod-011"],
  "savedAt": "2026-07-29T10:00:00Z"
}
```

**Response 404:** No saved selection for that codename.

---

## Blob Storage Layout

```
Container: product-selections
└── selections/
    ├── my-config.json
    ├── prod-east-2026.json
    └── ...
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | C# Azure Functions v4 (.NET 6) |
| Storage | Azure Blob Storage |
| Hosting | Azure Static Web Apps (free tier) |
| CI/CD | GitHub Actions |
