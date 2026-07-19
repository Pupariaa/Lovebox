SET NAMES utf8mb4;

-- Per-sender custom name for a paired box. Only the partner who set it sees it; the owner and other
-- partners are unaffected. NULL means "use the default 'Boite de <owner first name>' label".
ALTER TABLE pairings
    ADD COLUMN IF NOT EXISTS alias VARCHAR(64) NULL AFTER relationship_type;
