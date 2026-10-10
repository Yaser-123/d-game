# [ D-GAME ] : PSYCHOLOGICAL DUELING TERMINAL

> **"In the depths of the underground network, your mind is the only weapon."**

D-Game is an intense, terminal-aesthetic web application where players engage in high-stakes, psychological minigames. Built on a zero-trust architecture, the game enforces strict ledger-based economies, permadeath mechanics, and asymmetric player abilities via permanent "Sigils".

Play against perfect-play AI Bosses or challenge other operatives in live PvP duels.

## 🎯 Features

* **Strict Ledger Economy:** Your points are your life. Transactions are handled entirely via secure server-side PostgreSQL ledgers.
* **The Sigil System:** Upon registration, every account is permanently assigned one of six random Sigils (e.g., *Neural Weave*, *Void Gaze*). Sigils grant unique, asymmetric advantages in specific minigames.
* **Psychological Minigames:** High-pressure, 3-HP duels including:
  * *Void Chamber* (Russian Roulette)
  * *Bluff Duel* (Poisoned Chalice Mind Games)
  * *Doomsday* (Push-your-luck ticking timebomb)
  * *Minefield* (Grid-based hidden dangers)
  * *Nim Game* (Classic 21-pearl mathematical trap)
* **The Black Market:** Spend your hard-earned points on tactical gear like *Adrenaline Stims* (heal mid-battle) or *Chrono-Shift Devices* (skip turns).
* **Live Multiplayer PvP & AI Boss Hunts:** Challenge other players in real-time, or take on automated Boss Bots programmed in raw PL/pgSQL to execute mathematically perfect strategies.

## 💻 Tech Stack

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons.
* **Backend:** Supabase (Auth, PostgreSQL DB).
* **Game Logic Engine:** Complex, transaction-safe PL/pgSQL functions handling bot AI, combat resolution, and item usage entirely on the server.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18+)
* [Supabase CLI](https://supabase.com/docs/guides/cli) installed locally.

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/d-game.git
cd d-game
npm install
```

### 2. Setup Supabase Environment
You will need a Supabase project. Once created, duplicate `.env.example` to `.env.local` (or create it) and add your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Initialize the Database
D-Game relies heavily on custom SQL functions, RPCs, and row-level security. You must apply the migrations to your Supabase project.

If you are using a hosted Supabase project, link it and push the migrations:
```bash
supabase link --project-ref your-project-id
supabase db push
```
*(Note: Ensure you run the migrations in sequential order so that the sigils, items, and bots are correctly seeded into the database).*

### 4. Run the Terminal
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to enter the network.

---

## 📖 The Lore & Mechanics

### Operative Status
* **ACTIVE:** Normal gameplay.
* **FINAL_SALVATION:** Triggered when an operative falls into severe debt. Black Market access is revoked, and you are forced to fight Bosses to pay off your balance.
* **ELIMINATED:** Permadeath. You hit 0 Points and failed to survive.

### Tactical Gear
Items purchased from the Black Market are injected directly into your active duel UI. For example, using a **Chrono-Shift Device** will literally skip your turn in the database, forcing your opponent to act when they weren't prepared.

---

## 🤝 Contributing
Contributions, bug reports, and feature requests are welcome! Feel free to open an issue or submit a pull request.
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
