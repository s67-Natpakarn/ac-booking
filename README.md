# AC Cleaning Booking System

A web application that converts Excel-based air-conditioner cleaning schedules into online bookings. Users can select an available time slot for their room on its assigned cleaning date.

**[Live Website](https://bps-acbooking.onrender.com/)** · **[Source Code](https://github.com/s67-Natpakarn/ac-booking)**

## Background

This project was inspired by a scheduling task at my mother's workplace.

For each cleaning cycle, staff received an Excel file listing the rooms assigned to each cleaning date. They then manually created a separate Google Form for every date so users could choose their preferred time slot.

For example, a five-day cleaning schedule required five separate forms, each containing different room assignments. Recreating these forms for every cleaning cycle was repetitive and introduced opportunities for mistakes.

I developed this application to simplify the process: staff upload the Excel schedule, and the system automatically generates the booking options on one website.

## Features

- **Excel Import** — Import room assignments and cleaning schedules directly from an Excel file.
- **Automatic Booking Setup** — Generate booking options from the uploaded schedule instead of manually creating separate forms.
- **Date-Based Room Assignments** — Keep each room associated with its designated cleaning date.
- **Time-Slot Selection** — Allow users to choose an available time slot for their room.
- **Staff-Assistance Requests** — Record whether staff assistance is required.
- **Centralized Booking Records** — Store schedules, rooms, time slots, and bookings in a PostgreSQL database.

## Workflow

1. Staff upload an Excel file containing room assignments and cleaning dates.
2. The application processes the file and generates the booking schedule.
3. Users find their room and its assigned cleaning date.
4. Users select an available time slot and submit their booking.
5. The application saves the booking details in the database.

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js |
| UI Library | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Excel Processing | ExcelJS |
| Icons | Lucide React |
| Web Hosting | Render |

## Data Models

| Model | Purpose |
|---|---|
| `SystemSetting` | Stores the active booking session settings and uploaded filename |
| `CleaningDate` | Represents a scheduled cleaning date |
| `Room` | Stores room details and links each room to a cleaning date |
| `TimeSlot` | Defines booking times for each cleaning date |
| `Booking` | Records the selected room, time slot, and staff-assistance preference |

## My Contribution

I developed the application to address a real scheduling problem. My work included:

- Translating the existing Excel and Google Forms workflow into a web application.
- Building the booking interface with Next.js and TypeScript.
- Implementing Excel import and automatic booking setup.
- Designing the database models using Prisma ORM and PostgreSQL.
- Implementing room and time-slot booking logic.
- Deploying the website on Render.

## Getting Started

### Prerequisites

- A Node.js version compatible with the project's Next.js version
- npm
- A PostgreSQL database

### 1. Clone the Repository

```bash
git clone https://github.com/s67-Natpakarn/ac-booking.git
cd ac-booking
```

### 2. Install Dependencies

```bash
npm install
```

Prisma Client is generated automatically by the `postinstall` script.

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

Replace the placeholders with your PostgreSQL connection details.

For a local database, both variables can use the same connection URL. If your database provider supplies separate pooled and direct connections, use the appropriate URL for each.

### 4. Create the Database Tables

```bash
npx prisma db push
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Synchronize the database schema and build the application |
| `npm start` | Start the production server after building |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Regenerate Prisma Client |
| `npx prisma db push` | Synchronize the Prisma schema with the database |
| `npx prisma studio` | Open Prisma Studio to inspect database records |

The current build script runs `prisma db push` before `next build`. It therefore requires a database connection and may update the database schema.

## Deployment

The live application is hosted on Render:

**https://bps-acbooking.onrender.com/**

To deploy your own instance, configure the database environment variables and use:

**Build command**

```bash
npm ci && npm run build
```

**Start command**

```bash
npm start
```

## Future Improvements

Potential enhancements include:

- Providing a downloadable Excel template with clear formatting instructions.
- Adding booking confirmations and reminders.
- Expanding automated tests for Excel imports and booking workflows.
- Improving booking summaries and reporting.

## Privacy

Use fictional room numbers and booking details in public screenshots or sample files. Do not commit database credentials, environment files, or real user information.

## Author

**Natpakarn Pornchaloempong**

[GitHub](https://github.com/s67-Natpakarn)
