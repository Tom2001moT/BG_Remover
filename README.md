# ✂️ ClearCut: Local AI Background Eraser

ClearCut is a powerful, privacy-focused web application that removes image backgrounds locally in your browser. No data ever leaves your device. It also leverages Google's Gemini Vision AI to generate professional product listings from your cutouts.

## ✨ Key Features

- **100% Private**: Background removal happens entirely on your machine using local AI models.
- **No Cloud Required**: Works without sending your source images to any external server for the erasing process.
- **Magic Listing Generator**: Automatically analyzes your subject using Gemini Vision AI to create:
  - Catchy Product Names
  - Enticing Marketing Descriptions
  - SEO-friendly Social Media Captions & Hashtags
- **High Quality**: Downloads results as transparent PNGs.
- **Modern UI**: Clean, responsive design with live processing previews and checkerboard transparency view.

## 🚀 Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS
- **AI Processing**: `@imgly/background-removal` (Wasm/WebWorker)
- **Intelligence**: Google Gemini 2.5 Flash API
- **Icons**: Lucide React
- **Deployment**: Firebase Hosting

## 🛠️ Setup & Installation

### Prerequisites

- Node.js (Latest LTS recommended)
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd BG_Remover
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 📦 Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist/` folder, ready to be deployed to Firebase or any static hosting service.

## 📄 License

MIT License - feel free to use this for your own projects!
