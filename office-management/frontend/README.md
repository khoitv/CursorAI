# Office Management

Vue 3 + TypeScript office management app with CRUD for **Office Layouts**, **Rooms**, **Tables**, and **Employees**.

## Stack

- **Vue 3** (Composition API)
- **TypeScript**
- **Pinia** (state)
- **Vue Router**
- **Tailwind CSS**
- **Vite**

## Theme

Primary color: `#6367FF` with a full palette (50–950) in Tailwind as `primary-*`.

## Project structure

```
src/
├── assets/          # Global styles (Tailwind)
├── components/
│   ├── icons/       # SVG icon components
│   ├── layout/      # AppLayout (sidebar + main)
│   └── ui/          # Modal, etc.
├── router/          # Vue Router config
├── stores/          # Pinia stores (layouts, rooms, tables, employees)
├── types/           # Shared TypeScript types
├── views/           # Page views (Layouts, Rooms, Tables, Employees)
├── App.vue
└── main.ts
```

## Commands

```bash
npm install
npm run dev     # dev server
npm run build   # production build
npm run preview # preview production build
```

## Features

- **Office layout**: name, description
- **Room**: name, layout, floor, capacity
- **Table**: name, room, seats, position (x, y)
- **Employee**: name, email, role, department, optional table assignment

Data is kept in memory (Pinia); no backend. Optimized UX with modals, empty states, and transitions.
