# D-Game

A web-based multiplayer social survival game.

## Overview
D-Game is an original dark social PvP survival game. Every player receives ONE permanent randomly generated Sigil. Information is valuable, and players can fight, avoid, investigate, deceive, cooperate, and compete.

## Architecture Principles
- **Next.js App Router** for full-stack application routing.
- **Tailwind CSS** for atomic, responsive styling.
- **Supabase** for PostgreSQL, authentication, and real-time capabilities.
- **TypeScript** for strict static typing.

## Project Structure
- `app/`: Next.js application routes and layouts.
- `components/`: Reusable UI components.
- `game-engine/`: Game logic, rules, actions, and validations (UI-agnostic).
- `lib/`: Shared utilities and helpers.
- `types/`: Global TypeScript definitions.
- `supabase/`: Database migrations, schema, and config.
- `public/`: Static assets.

## Development Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env.local` and populate Supabase keys.
4. Run `npm run dev` to start the development server.
