UPDATE messages
SET status = 'queued', delivered_at = NULL
WHERE status = 'delivering';
