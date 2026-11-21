# KBR Smart Calculator Pro — KBR Tech

A production-ready, black-and-gold Android-compatible smart calculator application by **KBR Tech** supporting **Normal & Scientific Calculation**, **Live AI Camera Math Scanning + OCR**, **Multi-Language Voice Commands (English, Urdu, Roman Urdu)**, **Step-by-Step AI Solver**, **Persistent History**, and **11 Utility Calculators**.

---

## Features

1. **Normal & Scientific Calculator (Offline-Ready)**
   - Safe deterministic expression parser (`mathjs` — zero `eval()`).
   - Addition, subtraction, multiplication, division, percentage, brackets, decimal, `√`, `∛`, `x²`, `x³`, `xʸ`, `1/x`, `π`, `e`, `n!`, `sin`, `cos`, `tan`, inverse trig (`asin`, `acos`, `atan`), `log`, `ln`, `DEG`/`RAD` toggle, scientific notation, fraction ↔ decimal conversion, memory (`MC`, `MR`, `M+`, `M-`), and calculation history.
   - Prominent gold **AI Camera Scan** and **Voice** triggers directly on the home screen.

2. **AI Camera Math Scanner & OCR Pipeline**
   - Live `getUserMedia` camera preview with front/rear camera switching, flashlight/torch toggle (on supported mobile hardware), gallery image picker, and optional **Continuous Math Scan** frame detector.
   - Interactive **Crop & Rotate** canvas editor + **Image Enhancement** (contrast, brightness, sharpen, grayscale binarization).
   - Offline **Tesseract.js OCR** text extraction with editable expression confirmation before solving.
   - Server-side multimodal **Google Gemini (`gemini-4-hydrogen`)** recognition & step-by-step solving for handwritten notes, printed textbooks, fractions, percentages, linear/quadratic equations, geometry, trigonometry, basic calculus, word problems, and multi-question pages.
   - Deterministic `mathjs` verification of arithmetic/algebraic answers.

3. **Voice Calculator & Camera+Voice AI Assistant**
   - Real microphone speech recognition via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
   - Understands natural spoken math in **English** (*"Twenty percent of five hundred"*), **Roman Urdu** (*"Paanch jama paanch"*, *"Sau taqseem chaar"*, *"Das guna bees"*, *"Calculator clear karo"*), and **Urdu script** (*"پانچ جمع پانچ"*).
   - Speaks answers aloud via Web Speech Synthesis (`speechSynthesis`) with adjustable speed.
   - Supports contextual AI follow-up voice commands after scanning a photo (*"Isko step by step samjhao"*, *"Urdu mein samjhao"*, *"Sirf final answer dikhao"*).

4. **Extra Tools, History, Themes & Android PWA**
   - 11 built-in tools: Percentage, Discount, Tax, EMI, Age, Date Difference, Unit Converter, Currency Converter (with editable rates), Fraction, Ratio, and Average calculators.
   - Local persistent history (`localStorage`) with input-method labels (`Camera`, `Voice`, `Keyboard`), copy, share, reopen, and delete controls.
   - Black-and-Gold Dark Mode & Warm Ivory-and-Gold Light Mode, haptic vibration feedback, and full PWA offline support.

---

## Installation & Local Setup

### Prerequisites
- **Node.js 20+** and **npm 10+**
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your Gemini API key**
   Create a `.env` file in the project root (copy from `.env.example`):
   ```env
   GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
   ```
   > **Important:** Never place your Gemini API key in frontend `VITE_*` variables. The Express backend (`server.ts`) reads `process.env.GEMINI_API_KEY` securely on the server.
   > In Google AI Studio Build, set `GEMINI_API_KEY` in **Settings > Secrets**.

3. **Run in development mode**
   ```bash
   npm run dev
   ```
   The app and API server run together on `http://localhost:3000`.

4. **Build for production**
   ```bash
   npm run build
   npm start
   ```

---

## Building an Android APK

See [`ANDROID_APK_GUIDE.md`](./ANDROID_APK_GUIDE.md) for complete step-by-step instructions to package this app into a signed Android `.apk` / `.aab` using **Capacitor** or **Bubblewrap (TWA)**.
