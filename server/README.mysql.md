# MySQL Setup

This backend now reads data from MySQL instead of the in-memory `data.js` file.

## Tables

The initialization script creates these core tables:

- `users`: platform editors and admins
- `categories`: article categories
- `topics`: tracked political topics
- `briefings`: homepage briefing configuration
- `briefing_metrics`
- `briefing_live_points`
- `briefing_agenda_items`
- `articles`: article metadata
- `article_topic_relations`
- `article_tags`
- `article_tag_relations`
- `article_paragraphs`

## Initialization

1. Create a MySQL 8.0+ database by importing [server/sql/init.sql](sql/init.sql).
2. Copy [server/.env.example](.env.example) to `server/.env` and update the connection values.
3. Install dependencies:

```bash
npm install
npm install --prefix server
npm install --prefix web
```

4. Start the project:

```bash
npm run dev
```

## Import examples

`mysql -u root -p < server/sql/init.sql`

PowerShell:

```powershell
Get-Content .\server\sql\init.sql | mysql -u root -p
```
