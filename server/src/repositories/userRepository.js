import { query } from "../db.js";

function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    status: row.status
  };
}

export async function findUserById(id) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        display_name AS displayName,
        email,
        password_hash AS passwordHash,
        role,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function findUserByUsername(username) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        display_name AS displayName,
        email,
        password_hash AS passwordHash,
        role,
        status
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        display_name AS displayName,
        email,
        password_hash AS passwordHash,
        role,
        status
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function findUserByAccount(account) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        display_name AS displayName,
        email,
        password_hash AS passwordHash,
        role,
        status
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1
    `,
    [account, account]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function createUser({ username, displayName, email, passwordHash }) {
  const result = await query(
    `
      INSERT INTO users (username, display_name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'editor', 'active')
    `,
    [username, displayName, email, passwordHash]
  );

  return findUserById(result.insertId);
}
