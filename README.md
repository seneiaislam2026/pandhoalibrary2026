# Pandhoa Open Library

A complete Full-Stack Library Management System tailored for "Pandhoa Open Library". Built with React, Tailwind CSS, Vite, Node.js, Express, and mock-database (easily upgradable to MongoDB).

## Features Included

- **Admin Login & Control:** Pre-configured secure admin access.
- **Reader Registration:** Readers register and wait for approval. bKash payment instructions displayed.
- **Book Management:** Full CRUD operations on books. Supports cover images, pre-booking for issued books, and public catalog search.
- **Issue & Return Tracking:** Manage book issue lifecycles.
- **Donation System:** Complete donation flow.
- **Finance Reports:** Track Library incomes & expenses (automatic entry created on recorded public donation).
- **Public Showcases:** Dedicated panels for Donors, Management Team, and Blog.
- **Contact:** WhatsApp integration for easy communication.

## Default Credentials
- **Admin Username:** \`Library2026\`
- **Admin Password:** \`Library@@2026\`

## Local Setup Instructions

1. **Install Dependencies:**
   Run \`npm install\` to download all required packages.

2. **Start the Application:**
   Run \`npm run dev\` to start both the Vite development preview and the backend Express server concurrently.

3. **Database Architecture:**
   While the application uses a structured JSON-based store in development, the APIs and routes are configured properly so adding Mongoose + MongoDB in the \`readDb\` and \`writeDb\` util functions in \`server.ts\` is a straightforward drop-in replacement.

## Access Flow
- The application automatically starts.
- Access the public view to see Books, Team, Donors, and Blog.
- Click **Log In** via the top nav to access your Library Dashboard.
