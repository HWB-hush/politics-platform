import { query } from "../db.js";

let tablesReadyPromise;

export function ensureRealtimeTables() {
  if (!tablesReadyPromise) {
    tablesReadyPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS realtime_source_latest (
          source_key VARCHAR(100) PRIMARY KEY,
          source_name VARCHAR(120) NOT NULL,
          source_url VARCHAR(500) NOT NULL,
          parser_type VARCHAR(32) NOT NULL,
          extracted_value TEXT DEFAULT NULL,
          raw_payload LONGTEXT DEFAULT NULL,
          http_status INT DEFAULT NULL,
          sync_status ENUM('success', 'error') NOT NULL DEFAULT 'success',
          error_message TEXT DEFAULT NULL,
          fetched_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS realtime_source_history (
          id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          source_key VARCHAR(100) NOT NULL,
          source_name VARCHAR(120) NOT NULL,
          source_url VARCHAR(500) NOT NULL,
          parser_type VARCHAR(32) NOT NULL,
          extracted_value TEXT DEFAULT NULL,
          raw_payload LONGTEXT DEFAULT NULL,
          http_status INT DEFAULT NULL,
          sync_status ENUM('success', 'error') NOT NULL DEFAULT 'success',
          error_message TEXT DEFAULT NULL,
          fetched_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_realtime_source_history_key_time (source_key, fetched_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await query("ALTER TABLE realtime_source_latest MODIFY COLUMN parser_type VARCHAR(32) NOT NULL");
      await query("ALTER TABLE realtime_source_history MODIFY COLUMN parser_type VARCHAR(32) NOT NULL");
    })();
  }

  return tablesReadyPromise;
}

export async function saveRealtimeResult(record) {
  await ensureRealtimeTables();

  const {
    sourceKey,
    sourceName,
    sourceUrl,
    parserType,
    extractedValue,
    rawPayload,
    httpStatus,
    syncStatus,
    errorMessage,
    fetchedAt
  } = record;

  await query(
    `
      INSERT INTO realtime_source_history (
        source_key, source_name, source_url, parser_type, extracted_value,
        raw_payload, http_status, sync_status, error_message, fetched_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sourceKey,
      sourceName,
      sourceUrl,
      parserType,
      extractedValue,
      rawPayload,
      httpStatus,
      syncStatus,
      errorMessage,
      fetchedAt
    ]
  );

  await query(
    `
      INSERT INTO realtime_source_latest (
        source_key, source_name, source_url, parser_type, extracted_value,
        raw_payload, http_status, sync_status, error_message, fetched_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_url = VALUES(source_url),
        parser_type = VALUES(parser_type),
        extracted_value = VALUES(extracted_value),
        raw_payload = VALUES(raw_payload),
        http_status = VALUES(http_status),
        sync_status = VALUES(sync_status),
        error_message = VALUES(error_message),
        fetched_at = VALUES(fetched_at)
    `,
    [
      sourceKey,
      sourceName,
      sourceUrl,
      parserType,
      extractedValue,
      rawPayload,
      httpStatus,
      syncStatus,
      errorMessage,
      fetchedAt
    ]
  );
}

export async function listLatestRealtimeResults() {
  await ensureRealtimeTables();

  return query(`
    SELECT
      source_key AS sourceKey,
      source_name AS sourceName,
      source_url AS sourceUrl,
      parser_type AS parserType,
      extracted_value AS extractedValue,
      raw_payload AS rawPayload,
      http_status AS httpStatus,
      sync_status AS syncStatus,
      error_message AS errorMessage,
      fetched_at AS fetchedAt,
      updated_at AS updatedAt
    FROM realtime_source_latest
    ORDER BY updated_at DESC, source_key ASC
  `);
}

export async function listRealtimeHistory(sourceKey, limit = 20) {
  await ensureRealtimeTables();

  return query(
    `
      SELECT
        id,
        source_key AS sourceKey,
        source_name AS sourceName,
        source_url AS sourceUrl,
        parser_type AS parserType,
        extracted_value AS extractedValue,
        raw_payload AS rawPayload,
        http_status AS httpStatus,
        sync_status AS syncStatus,
        error_message AS errorMessage,
        fetched_at AS fetchedAt,
        created_at AS createdAt
      FROM realtime_source_history
      WHERE source_key = ?
      ORDER BY fetched_at DESC, id DESC
      LIMIT ?
    `,
    [sourceKey, limit]
  );
}
